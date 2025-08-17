import { useEffect, useState, useMemo } from 'react';
import { Search, Grid, Plus, Upload, Link as LinkIcon, Brain, Filter, BoxIcon, List, BookOpen, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { GlassCrawlDepthSelector } from '../components/ui/GlassCrawlDepthSelector';
import { useStaggeredEntrance } from '../hooks/useStaggeredEntrance';
import { useToast } from '../contexts/ToastContext';
import { knowledgeBaseService, KnowledgeItem, KnowledgeItemMetadata } from '../services/knowledgeBaseService';
import { CrawlingProgressCard } from '../components/knowledge-base/CrawlingProgressCard';
import { CrawlProgressData, crawlProgressService } from '../services/crawlProgressService';
import { WebSocketState } from '../services/socketIOService';
import { KnowledgeTable } from '../components/knowledge-base/KnowledgeTable';
import { KnowledgeItemCard } from '../components/knowledge-base/KnowledgeItemCard';
import { GroupedKnowledgeItemCard } from '../components/knowledge-base/GroupedKnowledgeItemCard';
import { KnowledgeGridSkeleton, KnowledgeTableSkeleton } from '../components/knowledge-base/KnowledgeItemSkeleton';
import { GroupCreationModal } from '../components/knowledge-base/GroupCreationModal';
// Logging
import { createLogger } from '../lib/logger';

interface GroupedKnowledgeItem {
  id: string;
  title: string;
  domain: string;
  items: KnowledgeItem[];
  metadata: KnowledgeItemMetadata;
  created_at: string;
  updated_at: string;
}

export const KnowledgeBasePage = () => {
  const kbLogger = createLogger('KnowledgeBasePage');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'technical' | 'business'>('all');
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [progressItems, setProgressItems] = useState<CrawlProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const { showToast } = useToast();

  const loadKnowledgeItems = async () => {
    const startTime = Date.now();
    kbLogger.debug('📊 Loading all knowledge items from API...');
    try {
      setLoading(true);
      const response = await knowledgeBaseService.getKnowledgeItems({
        page: currentPage,
        per_page: 100
      });
      const loadTime = Date.now() - startTime;
      kbLogger.debug(`📊 API request completed in ${loadTime}ms, loaded ${response.items.length} items`);
      setKnowledgeItems(response.items);
      setTotalItems(response.total);
    } catch (error) {
      kbLogger.error('Failed to load knowledge items:', error);
      showToast('Failed to load knowledge items', 'error');
      setKnowledgeItems([]);
    } finally {
      setLoading(false);
    }
  };
  
    // Progress handling functions
  const handleProgressComplete = (data: CrawlProgressData) => {
    kbLogger.info('Crawl completed:', data);

    // Update the progress item to show completed state first
    setProgressItems(prev =>
      prev.map(item =>
        item.progressId === data.progressId
          ? { ...data, status: 'completed', percentage: 100 }
          : item
      )
    );

    // Clean up from localStorage immediately
    try {
      localStorage.removeItem(`crawl_progress_${data.progressId}`);
      const activeCrawls = JSON.parse(localStorage.getItem('active_crawls') || '[]');
      const updated = activeCrawls.filter((id: string) => id !== data.progressId);
      localStorage.setItem('active_crawls', JSON.stringify(updated));
    } catch (error) {
      kbLogger.warn('Failed to clean up completed crawl:', error);
    }

    // Stop the Socket.IO streaming for this progress
    crawlProgressService.stopStreaming(data.progressId);

    // Show success toast
    const message = data.uploadType === 'document'
      ? `Document "${data.fileName}" uploaded successfully!`
      : `Crawling completed for ${data.currentUrl}!`;
    showToast(message, 'success');

    // Remove from progress items after a brief delay to show completion
    setTimeout(() => {
      setProgressItems(prev => prev.filter(item => item.progressId !== data.progressId));
      loadKnowledgeItems(); // Refresh the list
    }, 2000);
  };

  const handleProgressError = (error: string, progressId?: string) => {
    kbLogger.error(`Crawl error for ${progressId}:`, error);
    const itemInError = progressItems.find(p => p.progressId === progressId);
    showToast(`Crawling failed: ${error}`, 'error');
    
    if (progressId) {
        setProgressItems(prev => prev.map(item => 
            item.progressId === progressId ? { ...item, status: 'error', error: error } : item
        ));
    }
  };

  const handleProgressUpdate = (data: CrawlProgressData) => {
    setProgressItems(prev => 
      prev.map(item => 
        item.progressId === data.progressId ? { ...item, ...data } : item
      )
    );

    try {
      const existingData = localStorage.getItem(`crawl_progress_${data.progressId}`);
      if (existingData) {
        const parsed = JSON.parse(existingData);
        localStorage.setItem(`crawl_progress_${data.progressId}`, JSON.stringify({
          ...parsed,
          ...data,
          lastUpdated: Date.now()
        }));
      }
    } catch (error) {
      kbLogger.warn('Failed to update crawl progress in localStorage:', error);
    }
  };

  useEffect(() => {
    kbLogger.debug('🚀 KnowledgeBasePage: Mounted');
    loadKnowledgeItems();

    const loadActiveCrawls = async () => {
      kbLogger.debug('🔄 Checking for active crawls in localStorage...');
      const activeCrawls = JSON.parse(localStorage.getItem('active_crawls') || '[]');
      if (activeCrawls.length === 0) return;

      kbLogger.info(`Found ${activeCrawls.length} active crawls to reconnect.`);
      for (const progressId of activeCrawls) {
        const crawlDataStr = localStorage.getItem(`crawl_progress_${progressId}`);
        if (crawlDataStr) {
          const crawlData = JSON.parse(crawlDataStr) as CrawlProgressData;
          setProgressItems(prev => [...prev.filter(p => p.progressId !== progressId), { ...crawlData, status: 'reconnecting' }]);

          await crawlProgressService.streamProgressEnhanced(progressId, {
            onMessage: handleProgressUpdate,
            onStateChange: (state) => kbLogger.debug(`[${progressId}] State: ${state}`),
            onError: (err) => handleProgressError(err instanceof Error ? err.message : 'WebSocket Error', progressId),
          });
        }
      }
    };

    loadActiveCrawls();

    return () => {
      kbLogger.debug('🧹 KnowledgeBasePage: Unmounting, stopping all streams.');
      crawlProgressService.stopAllStreams();
    };
  }, []);

  const filteredItems = useMemo(() => {
    return knowledgeItems.filter(item => {
      const typeMatch = typeFilter === 'all' || item.metadata.knowledge_type === typeFilter;
      const searchLower = searchQuery.toLowerCase();
      const searchMatch = !searchQuery || 
        item.title.toLowerCase().includes(searchLower) ||
        item.metadata.description?.toLowerCase().includes(searchLower) ||
        item.metadata.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
        item.source_id.toLowerCase().includes(searchLower);
      return typeMatch && searchMatch;
    });
  }, [knowledgeItems, typeFilter, searchQuery]);

  const groupedItems = useMemo(() => {
    if (viewMode !== 'grid') return [];
    return filteredItems
      .filter(item => item.metadata?.group_name)
      .reduce((groups: GroupedKnowledgeItem[], item) => {
        const groupName = item.metadata.group_name!;
        let group = groups.find(g => g.title === groupName);
        if (group) {
          group.items.push(item);
        } else {
          groups.push({
            id: `group_${groupName.replace(/\s+/g, '_')}`,
            title: groupName,
            domain: groupName,
            items: [item],
            metadata: { ...item.metadata },
            created_at: item.created_at,
            updated_at: item.updated_at,
          });
        }
        return groups;
      }, []);
  }, [filteredItems, viewMode]);

  const ungroupedItems = useMemo(() => {
    return viewMode === 'grid' ? filteredItems.filter(item => !item.metadata?.group_name) : [];
  }, [filteredItems, viewMode]);

  const { containerVariants: headerContainerVariants, itemVariants: headerItemVariants, titleVariants } = useStaggeredEntrance([1, 2], 0.15);
  const { containerVariants: contentContainerVariants, itemVariants: contentItemVariants } = useStaggeredEntrance(filteredItems, 0.05);

  const handleAddKnowledge = () => setIsAddModalOpen(true);
  const toggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev);
    if (isSelectionMode) {
      setSelectedItems(new Set());
      setLastSelectedIndex(null);
    }
  };

  const toggleItemSelection = (itemId: string, index: number, event: React.MouseEvent) => {
    const newSelected = new Set(selectedItems);
    if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        if (filteredItems[i]) newSelected.add(filteredItems[i].id);
      }
    } else {
      newSelected.has(itemId) ? newSelected.delete(itemId) : newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    setLastSelectedIndex(index);
  };

  const selectAll = () => setSelectedItems(new Set(filteredItems.map(item => item.id)));
  const deselectAll = () => {
    setSelectedItems(new Set());
    setLastSelectedIndex(null);
  };

  const deleteSelectedItems = async () => {
    if (selectedItems.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.size} items?`)) return;

    try {
      await Promise.all(Array.from(selectedItems).map(id => knowledgeBaseService.deleteKnowledgeItem(id)));
      showToast(`Successfully deleted ${selectedItems.size} items`, 'success');
      loadKnowledgeItems();
      toggleSelectionMode();
    } catch (error) {
      kbLogger.error('Failed to delete selected items:', error);
      showToast('Failed to delete some items', 'error');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelectionMode) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
          e.preventDefault();
          selectAll();
        } else if (e.key === 'Escape') {
          toggleSelectionMode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode, filteredItems]);

  const handleStartCrawl = async (progressId: string, initialData: Partial<CrawlProgressData>) => {
    kbLogger.info(`[${progressId}] Starting crawl...`, initialData);
    const newProgressItem: CrawlProgressData = {
      progressId,
      status: 'starting',
      percentage: 0,
      logs: ['Starting...'],
      ...initialData,
    };
    setProgressItems(prev => [...prev.filter(p => p.progressId !== progressId), newProgressItem]);

    try {
      const activeCrawls = JSON.parse(localStorage.getItem('active_crawls') || '[]');
      if (!activeCrawls.includes(progressId)) {
        localStorage.setItem('active_crawls', JSON.stringify([...activeCrawls, progressId]));
      }
      localStorage.setItem(`crawl_progress_${progressId}`, JSON.stringify({ ...newProgressItem, startedAt: Date.now() }));
    } catch (error) {
      kbLogger.error('Failed to persist crawl progress:', error);
    }

    await crawlProgressService.streamProgressEnhanced(progressId, {
      onMessage: handleProgressUpdate,
      onStateChange: (state) => kbLogger.debug(`[${progressId}] State changed: ${state}`),
      onError: (error) => handleProgressError(error instanceof Error ? error.message : 'WebSocket error', progressId),
    });
  };

    const handleRefreshItem = async (sourceId: string) => {
        try {
            kbLogger.debug(`🔄 Refreshing knowledge item: ${sourceId}`);
            const response = await knowledgeBaseService.refreshKnowledgeItem(sourceId);
            if ((response as any).progressId) {
                const item = knowledgeItems.find(i => i.source_id === sourceId);
                await handleStartCrawl((response as any).progressId, {
                    currentUrl: item?.url,
                    totalPages: 0,
                    processedPages: 0,
                });
                showToast('Refresh started...', 'info');
                setKnowledgeItems(prev => prev.filter(k => k.source_id !== sourceId));
            } else {
                showToast('Refresh finished instantly.', 'success');
                loadKnowledgeItems();
            }
        } catch (error) {
            kbLogger.error(`Failed to refresh item ${sourceId}:`, error);
            showToast('Failed to start refresh.', 'error');
        }
    };
    
    const handleDeleteItem = async (sourceId: string) => {
        if (!window.confirm(`Are you sure you want to delete this item?`)) return;
        try {
            if (sourceId.startsWith('group_')) {
                const groupName = sourceId.replace('group_', '').replace(/_/g, ' ');
                const group = groupedItems.find(g => g.title === groupName);
                if (group) {
                    await Promise.all(group.items.map(item => knowledgeBaseService.deleteKnowledgeItem(item.source_id)));
                    showToast(`Deleted group "${groupName}"`, 'success');
                }
            } else {
                await knowledgeBaseService.deleteKnowledgeItem(sourceId);
                showToast('Item deleted successfully', 'success');
            }
            loadKnowledgeItems();
        } catch (error) {
            kbLogger.error('Failed to delete item:', error);
            showToast('Failed to delete item.', 'error');
        }
    };
    
  const handleStopCrawl = async (progressId: string) => {
    try {
      await knowledgeBaseService.stopCrawl(progressId);
      handleProgressUpdate({ progressId, status: 'cancelled', percentage: -1 });
      showToast('Crawl stopped.', 'info');
    } catch (error) {
      kbLogger.error(`Failed to stop crawl ${progressId}:`, error);
      showToast('Failed to stop crawl.', 'error');
    }
  };
    
  return (
    <div>
      <motion.div className="flex justify-between items-center mb-8" initial="hidden" animate="visible" variants={headerContainerVariants}>
        <motion.h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3" variants={titleVariants}>
          <BookOpen className="w-7 h-7 text-green-500 filter drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
          Knowledge Base
        </motion.h1>
        <motion.div className="flex items-center gap-4" variants={headerItemVariants}>
          <div className="relative">
            <Input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." accentColor="purple" icon={<Search className="w-4 h-4" />} />
          </div>
          <div className="flex items-center bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-900 rounded-md overflow-hidden">
            <button onClick={() => setTypeFilter('all')} className={`p-2 ${typeFilter === 'all' ? 'bg-gray-200 dark:bg-zinc-800' : 'text-gray-500'}`} title="All"><Filter className="w-4 h-4" /></button>
            <button onClick={() => setTypeFilter('technical')} className={`p-2 ${typeFilter === 'technical' ? 'bg-blue-100 dark:bg-blue-500/10' : 'text-gray-500'}`} title="Technical"><BoxIcon className="w-4 h-4" /></button>
            <button onClick={() => setTypeFilter('business')} className={`p-2 ${typeFilter === 'business' ? 'bg-pink-100 dark:bg-pink-500/10' : 'text-gray-500'}`} title="Business"><Brain className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-900 rounded-md overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-purple-100 dark:bg-purple-500/10' : 'text-gray-500'}`} title="Grid View"><Grid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('table')} className={`p-2 ${viewMode === 'table' ? 'bg-blue-100 dark:bg-blue-500/10' : 'text-gray-500'}`} title="Table View"><List className="w-4 h-4" /></button>
          </div>
          <Button onClick={toggleSelectionMode} variant={isSelectionMode ? 'secondary' : 'ghost'} accentColor="blue"><CheckSquare className="w-4 h-4 mr-2" />{isSelectionMode ? 'Cancel' : 'Select'}</Button>
          <Button onClick={handleAddKnowledge} variant="primary" accentColor="purple"><Plus className="w-4 h-4 mr-2" />Knowledge</Button>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isSelectionMode && selectedItems.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-6">
            <Card className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">{selectedItems.size} item(s) selected</span>
                  <Button onClick={selectAll} variant="ghost" size="sm">Select All Visible</Button>
                  <Button onClick={deselectAll} variant="ghost" size="sm">Clear Selection</Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setIsGroupModalOpen(true)} variant="secondary" size="sm" accentColor="blue">Create Group</Button>
                  <Button onClick={deleteSelectedItems} variant="secondary" size="sm" accentColor="pink">Delete Selected</Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        {loading ? ( <KnowledgeGridSkeleton /> ) 
        : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={contentContainerVariants}
            initial="hidden"
            animate="visible"
          >
              {progressItems.map(p => (
                  <motion.div key={p.progressId} variants={contentItemVariants}>
                    <CrawlingProgressCard 
                        progressData={p} 
                        onStop={() => handleStopCrawl(p.progressId)} 
                        onRetry={() => {}} 
                        onDismiss={() => {}}
                        onComplete={handleProgressComplete}
                        onError={(err) => handleProgressError(err, p.progressId)}
                    />
                  </motion.div>
              ))}
              {groupedItems.map((group) => (
                  <motion.div key={group.id} variants={contentItemVariants}>
                    <GroupedKnowledgeItemCard groupedItem={group} onDelete={handleDeleteItem} onUpdate={loadKnowledgeItems} onRefresh={handleRefreshItem} />
                  </motion.div>
              ))}
              {ungroupedItems.map((item, index) => (
                  <motion.div key={item.id} variants={contentItemVariants}>
                    <KnowledgeItemCard item={item} onDelete={handleDeleteItem} onUpdate={loadKnowledgeItems} onRefresh={handleRefreshItem} isSelectionMode={isSelectionMode} isSelected={selectedItems.has(item.id)} onToggleSelection={(e) => toggleItemSelection(item.id, index, e)} />
                  </motion.div>
              ))}
          </motion.div>
        )}
      </div>
      
      {isAddModalOpen && <AddKnowledgeModal onClose={() => setIsAddModalOpen(false)} onSuccess={() => { loadKnowledgeItems(); setIsAddModalOpen(false); }} onStartCrawl={handleStartCrawl} />}
      {isGroupModalOpen && <GroupCreationModal selectedItems={knowledgeItems.filter(item => selectedItems.has(item.id))} onClose={() => setIsGroupModalOpen(false)} onSuccess={() => { setIsGroupModalOpen(false); toggleSelectionMode(); loadKnowledgeItems(); }} />}
    </div>
  );
};

interface AddKnowledgeModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onStartCrawl: (progressId: string, initialData: Partial<CrawlProgressData>) => void;
}

const AddKnowledgeModal = ({ onClose, onSuccess, onStartCrawl }: AddKnowledgeModalProps) => {
  const modalLogger = createLogger('AddKnowledgeModal');
  const [method, setMethod] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [knowledgeType, setKnowledgeType] = useState<'technical' | 'business'>('technical');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [crawlDepth, setCrawlDepth] = useState(2);
  const { showToast } = useToast();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (method === 'url') {
        if (!url.trim()) {
            showToast('Please enter a URL', 'error');
            return;
        }
        const crawlParams = { url, knowledge_type: knowledgeType, tags, max_depth: crawlDepth };
        const result = await knowledgeBaseService.crawlUrl(crawlParams);
        if ((result as any).progressId) {
          onStartCrawl((result as any).progressId, {
            ...crawlParams,
            uploadType: 'crawl',
          });
          showToast('Crawling started...', 'success');
          onClose();
        } else {
          showToast('Crawl finished instantly.', 'success');
          onSuccess();
        }
      } else {
        if (!selectedFile) {
            showToast('Please select a file', 'error');
            return;
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('knowledge_type', knowledgeType);
        formData.append('tags', JSON.stringify(tags));

        const result = await knowledgeBaseService.uploadDocument(selectedFile, { knowledge_type: knowledgeType, tags });

        if ((result as any).progressId) {
          onStartCrawl((result as any).progressId, {
            uploadType: 'document',
            fileName: selectedFile.name,
            fileType: selectedFile.type,
          });
          showToast('Upload started...', 'success');
          onClose();
        } else {
          showToast('Upload finished instantly.', 'success');
          onSuccess();
        }
      }
    } catch (error) {
      modalLogger.error('Failed to add knowledge:', error);
      showToast('Failed to add knowledge source', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl relative p-8">
        <h2 className="text-xl font-bold mb-8">Add Knowledge Source</h2>
        
        <div className="flex gap-4 mb-6">
          <button onClick={() => setMethod('url')} className={`flex-1 p-4 rounded-md border ${method === 'url' ? 'border-blue-500' : ''}`}>URL</button>
          <button onClick={() => setMethod('file')} className={`flex-1 p-4 rounded-md border ${method === 'file' ? 'border-pink-500' : ''}`}>File</button>
        </div>

        {method === 'url' ? (
          <div>
            <Input label="URL" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" />
            <GlassCrawlDepthSelector value={crawlDepth} onChange={setCrawlDepth} />
          </div>
        ) : (
          <div>
            <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
          </div>
        )}

        <div className="mt-4">
            <Input label="Tags" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter' && newTag.trim()) {
                    setTags([...tags, newTag.trim()]);
                    setNewTag('');
                }
            }} />
            <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
            </div>
        </div>

        <div className="flex justify-end gap-4 mt-8">
          <Button onClick={onClose} variant="ghost" disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} variant="primary" disabled={loading}>{loading ? 'Adding...' : 'Add Source'}</Button>
        </div>
      </Card>
    </div>
  );
};