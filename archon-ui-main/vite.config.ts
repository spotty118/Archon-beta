/// <reference types="vitest" />
import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import type { ConfigEnv, UserConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  
  // Get host and port from environment variables or use defaults
  // Always use the external host for proxy since we're connecting to remote server
  const backendHost = env.VITE_API_URL && env.VITE_API_URL.startsWith('http') 
    ? env.VITE_API_URL.replace('http://', '').replace('https://', '') 
    : '134.199.207.41:8181';
  const mcpHost = env.VITE_MCP_URL && env.VITE_MCP_URL.startsWith('http')
    ? env.VITE_MCP_URL.replace('http://', '').replace('https://', '')
    : '134.199.207.41:8051';
  const agentsHost = env.VITE_AGENTS_URL && env.VITE_AGENTS_URL.startsWith('http')
    ? env.VITE_AGENTS_URL.replace('http://', '').replace('https://', '')
    : '134.199.207.41:8052';
  
  return {
    plugins: [
      react(),
      // Beta Enhancement: Bundle analysis plugin for performance monitoring
      {
        name: 'bundle-analyzer',
        generateBundle(options, bundle) {
          if (mode === 'production') {
            const chunks = Object.values(bundle).filter(chunk => chunk.type === 'chunk');
            const totalSize = chunks.reduce((size, chunk) => size + (chunk.code?.length || 0), 0);
            
            console.log('📦 Bundle Analysis:');
            console.log(`Total bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
            
            chunks.forEach(chunk => {
              const size = (chunk.code?.length || 0) / 1024;
              if (size > 100) { // Only log chunks larger than 100KB
                console.log(`  ${chunk.fileName}: ${size.toFixed(2)} KB`);
              }
            });
            
            // Performance budget validation
            const initialBudget = 500 * 1024; // 500KB
            const totalBudget = 2 * 1024 * 1024; // 2MB
            
            // Check total bundle size
            if (totalSize > totalBudget) {
              console.warn(`⚠️ Total bundle size (${(totalSize / 1024 / 1024).toFixed(2)} MB) exceeds budget (2MB)`);
            }
            
            // Check individual chunk sizes against initial budget
            const oversizedChunks = chunks.filter(chunk => (chunk.code?.length || 0) > initialBudget);
            if (oversizedChunks.length > 0) {
              console.warn('⚠️ Oversized chunks detected:');
              oversizedChunks.forEach(chunk => {
                const size = (chunk.code?.length || 0) / 1024;
                console.warn(`  ${chunk.fileName}: ${size.toFixed(2)} KB (exceeds 500KB budget)`);
              });
            }
            
            // Performance recommendations
            if (totalSize > totalBudget * 0.8) {
              console.log('💡 Performance recommendations:');
              console.log('  - Consider using dynamic imports for large features');
              console.log('  - Review vendor chunk splitting strategy');
              console.log('  - Analyze bundle with: npm run build -- --bundle-analyzer');
            }
          }
        }
      },
      // Custom plugin to add test endpoint
      {
        name: 'test-runner',
        configureServer(server) {
          // Serve coverage directory statically
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/coverage/')) {
              const filePath = path.join(process.cwd(), req.url);
              console.log('[VITE] Serving coverage file:', filePath);
              try {
                const data = await readFile(filePath);
                const contentType = req.url.endsWith('.json') ? 'application/json' : 
                                  req.url.endsWith('.html') ? 'text/html' : 'text/plain';
                res.setHeader('Content-Type', contentType);
                res.end(data);
              } catch (err) {
                console.log('[VITE] Coverage file not found:', filePath);
                res.statusCode = 404;
                res.end('Not found');
              }
            } else {
              next();
            }
          });
          
          // Test execution endpoint (basic tests)
          server.middlewares.use('/api/run-tests', (req: any, res: any) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method not allowed');
              return;
            }

            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
            });

            // Run vitest with proper configuration (includes JSON reporter)
            const testProcess = exec('npm run test -- --run', {
              cwd: process.cwd()
            });

            testProcess.stdout?.on('data', (data) => {
              const text = data.toString();
              // Split by newlines but preserve empty lines for better formatting
              const lines = text.split('\n');
              
              lines.forEach((line: string) => {
                // Send all lines including empty ones for proper formatting
                res.write(`data: ${JSON.stringify({ type: 'output', message: line, timestamp: new Date().toISOString() })}\n\n`);
              });
              
              // Flush the response to ensure immediate delivery
              if (res.flushHeaders) {
                res.flushHeaders();
              }
            });

            testProcess.stderr?.on('data', (data) => {
              const lines = data.toString().split('\n').filter((line: string) => line.trim());
              lines.forEach((line: string) => {
                // Strip ANSI escape codes
                const cleanLine = line.replace(/\\x1b\[[0-9;]*m/g, '');
                res.write(`data: ${JSON.stringify({ type: 'output', message: cleanLine, timestamp: new Date().toISOString() })}\n\n`);
              });
            });

            testProcess.on('close', (code) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'completed', 
                exit_code: code, 
                status: code === 0 ? 'completed' : 'failed',
                message: code === 0 ? 'Tests completed and results generated!' : 'Tests failed',
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            testProcess.on('error', (error) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                message: error.message, 
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            req.on('close', () => {
              testProcess.kill();
            });
          });

          // Test execution with coverage endpoint
          server.middlewares.use('/api/run-tests-with-coverage', (req: any, res: any) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method not allowed');
              return;
            }

            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
            });

            // Run vitest with coverage using the proper script (now includes both default and JSON reporters)
            // Add CI=true to get cleaner output without HTML dumps
            // Override the reporter to use verbose for better streaming output
            // When running in Docker, we need to ensure the test results directory exists
            const testResultsDir = path.join(process.cwd(), 'public', 'test-results');
            if (!existsSync(testResultsDir)) {
              mkdirSync(testResultsDir, { recursive: true });
            }
            
            const testProcess = exec('npm run test:coverage:stream', {
              cwd: process.cwd(),
              env: { 
                ...process.env, 
                FORCE_COLOR: '1', 
                CI: 'true',
                NODE_ENV: 'test' 
              } // Enable color output and CI mode for cleaner output
            });

            testProcess.stdout?.on('data', (data) => {
              const text = data.toString();
              // Split by newlines but preserve empty lines for better formatting
              const lines = text.split('\n');
              
              lines.forEach((line: string) => {
                // Strip ANSI escape codes to get clean text
                const cleanLine = line.replace(/\\x1b\[[0-9;]*m/g, '');
                
                // Send all lines for verbose reporter output
                res.write(`data: ${JSON.stringify({ type: 'output', message: cleanLine, timestamp: new Date().toISOString() })}\n\n`);
              });
              
              // Flush the response to ensure immediate delivery
              if (res.flushHeaders) {
                res.flushHeaders();
              }
            });

            testProcess.stderr?.on('data', (data) => {
              const lines = data.toString().split('\n').filter((line: string) => line.trim());
              lines.forEach((line: string) => {
                // Strip ANSI escape codes
                const cleanLine = line.replace(/\\x1b\[[0-9;]*m/g, '');
                res.write(`data: ${JSON.stringify({ type: 'output', message: cleanLine, timestamp: new Date().toISOString() })}\n\n`);
              });
            });

            testProcess.on('close', (code) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'completed', 
                exit_code: code, 
                status: code === 0 ? 'completed' : 'failed',
                message: code === 0 ? 'Tests completed with coverage and results generated!' : 'Tests failed',
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            testProcess.on('error', (error) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                message: error.message, 
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            req.on('close', () => {
              testProcess.kill();
            });
          });

          // Coverage generation endpoint
          server.middlewares.use('/api/generate-coverage', (req: any, res: any) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method not allowed');
              return;
            }

            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
            });

            res.write(`data: ${JSON.stringify({ 
              type: 'status', 
              message: 'Starting coverage generation...', 
              timestamp: new Date().toISOString() 
            })}\n\n`);

            // Run coverage generation
            const coverageProcess = exec('npm run test:coverage', {
              cwd: process.cwd()
            });

            coverageProcess.stdout?.on('data', (data) => {
              const lines = data.toString().split('\n').filter((line: string) => line.trim());
              lines.forEach((line: string) => {
                res.write(`data: ${JSON.stringify({ type: 'output', message: line, timestamp: new Date().toISOString() })}\n\n`);
              });
            });

            coverageProcess.stderr?.on('data', (data) => {
              const lines = data.toString().split('\n').filter((line: string) => line.trim());
              lines.forEach((line: string) => {
                res.write(`data: ${JSON.stringify({ type: 'output', message: line, timestamp: new Date().toISOString() })}\n\n`);
              });
            });

            coverageProcess.on('close', (code) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'completed', 
                exit_code: code, 
                status: code === 0 ? 'completed' : 'failed',
                message: code === 0 ? 'Coverage report generated successfully!' : 'Coverage generation failed',
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            coverageProcess.on('error', (error) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                message: error.message, 
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            req.on('close', () => {
              coverageProcess.kill();
            });
          });
        }
      }
    ],
    server: {
      host: '0.0.0.0', // Listen on all network interfaces with explicit IP
      port: 5173, // Match the port expected in Docker
      strictPort: true, // Exit if port is in use
      proxy: {
        '/api': {
          target: `http://${backendHost}`,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('🚨 [VITE PROXY ERROR]:', err.message);
              console.log('🚨 [VITE PROXY ERROR] Target:', `http://${backendHost}`);
              console.log('🚨 [VITE PROXY ERROR] Request:', req.url);
            });
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('🔄 [VITE PROXY] Forwarding:', req.method, req.url, 'to', `http://${backendHost}${req.url}`);
            });
          }
        },
        // Socket.IO specific proxy configuration
        '/socket.io': {
          target: `http://${backendHost}`,
          changeOrigin: true,
          ws: true
        },
        // MCP service proxy
        '/mcp': {
          target: `http://${mcpHost}`,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/mcp/, '')
        },
        // Agents service proxy
        '/agents': {
          target: `http://${agentsHost}`,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/agents/, '')
        }
      },
    },
    // Beta Enhancement: Optimized build configuration for code splitting and performance
    build: {
      target: 'esnext',
      minify: 'esbuild',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          // Manual chunk splitting for optimal loading
          manualChunks: {
            // Vendor libraries (largest, most stable)
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            
            // UI libraries (medium size, occasional updates)
            'ui-vendor': [
              '@milkdown/crepe', 
              '@milkdown/kit', 
              '@milkdown/preset-commonmark',
              '@xyflow/react',
              'framer-motion'
            ],
            
            // Utility libraries (small, stable)
            'utils-vendor': [
              'clsx', 
              'tailwind-merge', 
              'date-fns', 
              'zod',
              'lucide-react'
            ],
            
            // Socket.IO and real-time features
            'realtime-vendor': ['socket.io-client'],
            
            // Drag and drop functionality
            'dnd-vendor': ['react-dnd', 'react-dnd-html5-backend'],
            
            // Code highlighting and processing
            'code-vendor': ['prismjs', 'fractional-indexing']
          },
          
          // Naming strategy for chunks
          chunkFileNames: (chunkInfo) => {
            if (chunkInfo.isEntry) {
              return 'assets/[name]-[hash].js';
            }
            return 'assets/[name]-[hash].js';
          },
          
          // Asset naming
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      
      // Performance budgets (will warn during build if exceeded)
      chunkSizeWarningLimit: 500, // 500KB warning for individual chunks
      
      // CSS code splitting
      cssCodeSplit: true
    },
    define: {
      'import.meta.env.VITE_HOST': JSON.stringify(backendHost.split(':')[0]),
      'import.meta.env.VITE_PORT': JSON.stringify(backendHost.split(':')[1] || '8181'),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      css: true,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/*.test.{ts,tsx}',
      ],
      env: {
        VITE_HOST: backendHost.split(':')[0],
        VITE_PORT: backendHost.split(':')[1] || '8181',
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'test/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData.ts',
          '**/*.test.{ts,tsx}',
        ],
      }
    }
  };
});
