import React, { useState, memo, useEffect } from 'react';
import { Plus, Settings } from 'lucide-react';
import { ClientCard } from './ClientCard';
import { ToolTestingPanel } from './ToolTestingPanel';
import { Button } from '../ui/Button';
import { mcpClientService, MCPClient, MCPClientConfig } from '../../services/mcpClientService';
import { useToast } from '../../contexts/ToastContext';
// Removed DeleteConfirmModal usage (no mock/hardcoded clients; deletion handled in edit drawer)

// Client interface (keeping for backward compatibility)
export interface Client {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  ip: string;
  lastSeen: string;
  version: string;
  tools: Tool[];
  region?: string;
  lastError?: string;
}

// Tool interface
export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
}

// Tool parameter interface
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  description?: string;
}

export const MCPClients = memo(() => {
  const [clients, setClients] = useState<Client[]>([]);
  // Loading state removed (parent should handle suspense if needed)
  const [error, setError] = useState<string | null>(null);
  // State for selected client and panel visibility
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  
  // State for edit drawer
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);

  // Toast available for future actions (currently not used)

  // Load clients when component mounts (effect placed after function declarations)

  // (Auto-load logic removed; consumer should pass clients or add load trigger)

  /**
   * Convert database MCP client to our Client interface
   */
  const convertDbClientToClient = (dbClient: MCPClient): Client => {
    // Map database status to our status types
    const statusMap: Record<string, 'online' | 'offline' | 'error'> = {
      'connected': 'online',
      'disconnected': 'offline',
      'connecting': 'offline', 
      'error': 'error'
    };

    // Extract connection info (Streamable HTTP-only)
  const config = dbClient.connection_config as any;
  const ip = config?.url || 'N/A';

    return {
      id: dbClient.id,
      name: dbClient.name,
      status: statusMap[dbClient.status] || 'offline',
      ip,
      lastSeen: dbClient.last_seen ? new Date(dbClient.last_seen).toLocaleString() : 'Never',
  version: config?.version || 'Unknown',
  region: config?.region || 'Unknown',
      tools: [], // Will be loaded separately
      lastError: dbClient.last_error || undefined
    };
  };

  /**
   * Load tools from any MCP client using universal client service
   */
  const loadTools = async (client: Client) => {
    try {
      const toolsResponse = await mcpClientService.getClientTools(client.id);
      
      // Convert client tools to our Tool interface format
      const convertedTools: Tool[] = toolsResponse.tools.map((clientTool: any, index: number) => {
        const parameters: ToolParameter[] = [];
        
        // Extract parameters from tool schema
        if (clientTool.tool_schema?.inputSchema?.properties) {
          const required = clientTool.tool_schema.inputSchema.required || [];
          Object.entries(clientTool.tool_schema.inputSchema.properties).forEach(([name, schema]: [string, any]) => {
            parameters.push({
              name,
              type: schema.type === 'integer' ? 'number' : 
                    schema.type === 'array' ? 'array' : 
                    schema.type === 'boolean' ? 'boolean' : 'string',
              required: required.includes(name),
              description: schema.description || `${name} parameter`
            });
          });
        }
        
        return {
          id: `${client.id}-${index}`,
          name: clientTool.tool_name,
          description: clientTool.tool_description || 'No description available',
          parameters
        };
      });

      client.tools = convertedTools;
      console.log(`Loaded ${convertedTools.length} tools for client ${client.name}`);
    } catch (error) {
      console.error(`Failed to load tools for client ${client.name}:`, error);
      client.tools = [];
    }
  };

  /**
   * Handle adding a new client
   */
  const handleAddClient = async (clientConfig: MCPClientConfig) => {
    try {
      // Create client in database
      const newClient = await mcpClientService.createClient(clientConfig);
      
      // Convert and add to local state
      const convertedClient = convertDbClientToClient(newClient);
      
      // Try to load tools if client is connected
      if (convertedClient.status === 'online') {
        await loadTools(convertedClient);
      }
      
      setClients(prev => [...prev, convertedClient]);
      
      // Close modal
      setIsAddClientModalOpen(false);
      
      console.log('Client added successfully:', newClient.name);
    } catch (error) {
      console.error('Failed to add client:', error);
      setError(error instanceof Error ? error.message : 'Failed to add client');
      throw error; // Re-throw so modal can handle it
    }
  };

  // Handle client selection
  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    setIsPanelOpen(true);
    
    // Refresh tools for the selected client if needed
    if (client.tools.length === 0 && client.status === 'online') {
      await loadTools(client);
      
      // Update the client in the list
      setClients(prev => prev.map(c => c.id === client.id ? client : c));
    }
  };

  // Handle client editing
  const handleEditClient = (client: Client) => {
    setEditClient(client);
    setIsEditDrawerOpen(true);
  };

  // Deletion now handled via edit drawer; placeholder for potential future inline delete
  const handleDeleteClient = (_client: Client) => {};

  // Refresh clients list (for after connection state changes)
  const refreshClients = async () => {
    try {
      const dbClients = await mcpClientService.getClients();
      const convertedClients = await Promise.all(
        dbClients.map(async (dbClient) => {
          const client = convertDbClientToClient(dbClient);
          if (client.status === 'online') {
            await loadTools(client);
          }
          return client;
        })
      );
      setClients(convertedClients);
    } catch (error) {
      console.error('Failed to refresh clients:', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh clients');
    }
  };

  // Removed confirm/cancel delete handlers

  // Always render (external controller decides when data ready)

  return (
    <div className="relative">
      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button 
            onClick={() => setError(null)} 
            className="text-red-500 hover:text-red-600 text-sm mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add Client Button */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">MCP Clients</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Connect and manage your MCP-enabled applications
          </p>
        </div>
        <Button
          onClick={() => setIsAddClientModalOpen(true)}
          variant="primary"
          accentColor="cyan"
          className="shadow-cyan-500/20 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Client Grid */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {clients.map(client => (
            <ClientCard 
              key={client.id} 
              client={client} 
              onSelect={() => handleSelectClient(client)}
              onEdit={() => handleEditClient(client)} 
              onDelete={() => handleDeleteClient(client)}
              onConnectionChange={refreshClients}
            />
          ))}
        </div>
      </div>
      
      {/* Tool Testing Panel */}
      <ToolTestingPanel 
        client={selectedClient} 
        isOpen={isPanelOpen} 
        onClose={() => setIsPanelOpen(false)} 
      />
      
      {/* Add Client Modal */}
      {isAddClientModalOpen && (
        <AddClientModal 
          isOpen={isAddClientModalOpen}
          onClose={() => setIsAddClientModalOpen(false)}
          onSubmit={handleAddClient}
        />
      )}
      
      {/* Edit Client Drawer */}
      {isEditDrawerOpen && editClient && (
        <EditClientDrawer 
          client={editClient}
          isOpen={isEditDrawerOpen}
          onClose={() => {
            setIsEditDrawerOpen(false);
            setEditClient(null);
          }}
          onUpdate={(updatedClient) => {
            // Update the client in state or remove if deleted
            setClients(prev => {
              if (!updatedClient) { // If updatedClient is null, it means deletion
                return prev.filter(c => c.id !== editClient?.id); // Remove the client that was being edited
              }
              return prev.map(c => c.id === updatedClient.id ? updatedClient : c);
            });
            setIsEditDrawerOpen(false);
            setEditClient(null);
          }}
        />
      )}

  {/* Delete confirmation modal removed: deletion via edit drawer */}
    </div>
  );
});

// Add Client Modal Component
interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: MCPClientConfig) => Promise<void>;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    auto_connect: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Client name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Validate URL
      if (!formData.url.trim()) {
        setError('MCP server URL is required');
        setIsSubmitting(false);
        return;
      }

      // Ensure URL is valid
      try {
        const url = new URL(formData.url);
        if (!url.protocol.startsWith('http')) {
          setError('URL must start with http:// or https://');
          setIsSubmitting(false);
          return;
        }
      } catch (e) {
        setError('Invalid URL format');
        setIsSubmitting(false);
        return;
      }

      const connection_config = {
        url: formData.url.trim()
      };

      const clientConfig: MCPClientConfig = {
        name: formData.name.trim(),
        transport_type: 'http',
        connection_config,
        auto_connect: formData.auto_connect
      };

      await onSubmit(clientConfig);
      
      // Reset form on success
      setFormData({
        name: '',
        url: '',
        auto_connect: true
      });
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add client');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 dark:bg-black/90 border border-gray-200 dark:border-gray-800 rounded-lg p-6 w-full max-w-md relative backdrop-blur-lg">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]"></div>
        
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Add New MCP Client
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client Name *
            </label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-white/50 dark:bg-black/50 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" 
              placeholder="Enter client name" 
              required
            />
          </div>

          {/* MCP Server URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              MCP Server URL *
            </label>
            <input 
              type="text" 
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 bg-white/50 dark:bg-black/50 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" 
              placeholder="http://host.docker.internal:8051/mcp" 
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              The HTTP endpoint URL of the MCP server
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <strong>Docker Note:</strong> Use <code>host.docker.internal</code> instead of <code>localhost</code> 
              to access services running on your host machine
            </p>
          </div>

          {/* Auto Connect */}
          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="auto_connect"
              checked={formData.auto_connect}
              onChange={(e) => setFormData(prev => ({ ...prev, auto_connect: e.target.checked }))}
              className="mr-2" 
            />
            <label htmlFor="auto_connect" className="text-sm text-gray-700 dark:text-gray-300">
              Auto-connect on startup
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              accentColor="cyan" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Client'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Client Drawer Component
interface EditClientDrawerProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (client: Client | null) => void; // Allow null to indicate deletion
}

const EditClientDrawer: React.FC<EditClientDrawerProps> = ({ client, isOpen, onClose, onUpdate }) => {
  const [editFormData, setEditFormData] = useState({
    name: client.name,
    url: '',
    auto_connect: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // State for delete confirmation modal (moved here)
  // Delete functionality handled via Edit drawer; no local delete state here now
  const { showToast: _unusedShowToast } = useToast();

  // Load current client config when drawer opens
  const loadClientConfig = React.useCallback(async () => {
    try {
      const dbClient = await mcpClientService.getClient(client.id);
      const config = dbClient.connection_config;
      
      setEditFormData({
        name: dbClient.name,
        url: config.url || '',
        auto_connect: dbClient.auto_connect
      });
    } catch (error) {
      console.error('Failed to load client config:', error);
      setError('Failed to load client configuration');
    }
  }, [client.id]);

  useEffect(() => {
    if (isOpen) {
      loadClientConfig();
    }
  }, [isOpen, loadClientConfig]);

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate URL
      if (!editFormData.url.trim()) {
        setError('MCP server URL is required');
        setIsSubmitting(false);
        return;
      }

      // Ensure URL is valid
      try {
        const url = new URL(editFormData.url);
        if (!url.protocol.startsWith('http')) {
          setError('URL must start with http:// or https://');
          setIsSubmitting(false);
          return;
        }
      } catch (e) {
        setError('Invalid URL format');
        setIsSubmitting(false);
        return;
      }

      const connection_config = {
        url: editFormData.url.trim()
      };

      // Update client via API
      const updatedClient = await mcpClientService.updateClient(client.id, {
        name: editFormData.name,
        transport_type: 'http',
        connection_config,
        auto_connect: editFormData.auto_connect
      });

      // Update local state
      const convertedClient = {
        ...client,
        name: updatedClient.name,
        ip: editFormData.url
      };
      
      onUpdate(convertedClient);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await mcpClientService.connectClient(client.id);
      // Reload the client to get updated status
      loadClientConfig();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await mcpClientService.disconnectClient(client.id);
      // Reload the client to get updated status
      loadClientConfig();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to disconnect');
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${client.name}"?`)) {
      try {
        await mcpClientService.deleteClient(client.id);
        onClose();
        // Trigger a reload of the clients list
        window.location.reload();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete client');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white/90 dark:bg-black/90 border border-gray-200 dark:border-gray-800 rounded-t-lg p-6 w-full max-w-2xl relative backdrop-blur-lg animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]"></div>
        
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-cyan-500" />
          Edit Client Configuration
        </h3>
        
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          {/* Client Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client Name *
            </label>
            <input 
              type="text" 
              value={editFormData.name}
              onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-white/50 dark:bg-black/50 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" 
              required
            />
          </div>

          {/* MCP Server URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              MCP Server URL *
            </label>
            <input 
              type="text" 
              value={editFormData.url}
              onChange={(e) => setEditFormData(prev => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 bg-white/50 dark:bg-black/50 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" 
              placeholder="http://host.docker.internal:8051/mcp" 
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              The HTTP endpoint URL of the MCP server
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <strong>Docker Note:</strong> Use <code>host.docker.internal</code> instead of <code>localhost</code> 
              to access services running on your host machine
            </p>
          </div>

          {/* Auto Connect */}
          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="edit_auto_connect"
              checked={editFormData.auto_connect}
              onChange={(e) => setEditFormData(prev => ({ ...prev, auto_connect: e.target.checked }))}
              className="mr-2" 
            />
            <label htmlFor="edit_auto_connect" className="text-sm text-gray-700 dark:text-gray-300">
              Auto-connect on startup
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                type="button"
                variant="ghost" 
                accentColor="green"
                onClick={handleConnect}
                disabled={isConnecting || client.status === 'online'}
              >
                {isConnecting ? 'Connecting...' : client.status === 'online' ? 'Connected' : 'Connect'}
              </Button>
              <Button 
                type="button"
                variant="ghost" 
                accentColor="orange"
                onClick={handleDisconnect}
                disabled={client.status === 'offline'}
              >
                {client.status === 'offline' ? 'Disconnected' : 'Disconnect'}
              </Button>
              <Button 
                type="button"
                variant="ghost" 
                accentColor="pink"
                onClick={handleDelete}
              >
                Delete Client
              </Button>
              <Button 
                type="button"
                variant="ghost" 
                accentColor="cyan"
                onClick={() => window.open(`/api/mcp/clients/${client.id}/status`, '_blank')}
              >
                Debug Status
              </Button>
            </div>
          </div>

          {/* Form Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              accentColor="cyan" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Configuration'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};