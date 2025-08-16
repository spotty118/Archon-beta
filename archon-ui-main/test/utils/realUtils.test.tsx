import { describe, test, expect } from 'vitest'

// Import actual utility functions
import { isLmConfigured, type NormalizedCredential } from '../../src/utils/onboarding'

describe('Real Utility Functions', () => {
  describe('isLmConfigured', () => {
    test('returns true when OpenAI provider and API key configured', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'openai', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'OPENAI_API_KEY', value: 'sk-test123', category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('returns false when OpenAI provider but no API key', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'openai', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = []
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(false)
    })

    test('returns true when OpenAI provider and encrypted API key', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'openai', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { 
          key: 'OPENAI_API_KEY', 
          is_encrypted: true, 
          encrypted_value: 'encrypted_key_data', 
          category: 'api_keys' 
        }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('returns true when Google provider and API key configured', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'google', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'GOOGLE_API_KEY', value: 'google-api-key-123', category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('returns false when Google provider but no API key', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'google', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = []
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(false)
    })

    test('returns true when Gemini provider and Google API key', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'gemini', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'GOOGLE_API_KEY', value: 'google-api-key-123', category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('returns true when Ollama provider regardless of API keys', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'ollama', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = []
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('returns true when unknown provider', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'custom-provider', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = []
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('returns true when no provider but OpenAI API key exists', () => {
      const ragCreds: NormalizedCredential[] = []
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'OPENAI_API_KEY', value: 'sk-test123', category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('returns true when no provider but Google API key exists', () => {
      const ragCreds: NormalizedCredential[] = []
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'GOOGLE_API_KEY', value: 'google-api-key-123', category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('returns false when no provider and no API keys', () => {
      const ragCreds: NormalizedCredential[] = []
      const apiKeyCreds: NormalizedCredential[] = []
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(false)
    })

    test('handles null/empty values correctly', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'openai', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'OPENAI_API_KEY', value: '', category: 'api_keys' },
        { key: 'OPENAI_API_KEY', value: 'null', category: 'api_keys' },
        { key: 'OPENAI_API_KEY', value: null as any, category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(false)
    })

    test('is case insensitive for providers', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'OPENAI', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'OPENAI_API_KEY', value: 'sk-test123', category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('is case insensitive for API key names', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'openai', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'openai_api_key', value: 'sk-test123', category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('prefers first valid API key when multiple exist', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'openai', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'OPENAI_API_KEY', value: '', category: 'api_keys' },
        { key: 'OPENAI_API_KEY', value: 'sk-valid123', category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('handles both OpenAI and Google keys when no provider', () => {
      const ragCreds: NormalizedCredential[] = []
      const apiKeyCreds: NormalizedCredential[] = [
        { key: 'OPENAI_API_KEY', value: '', category: 'api_keys' },
        { key: 'GOOGLE_API_KEY', value: 'google-key-123', category: 'api_keys' }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(true)
    })

    test('requires encrypted_value when is_encrypted is true', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'openai', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { 
          key: 'OPENAI_API_KEY', 
          is_encrypted: true, 
          category: 'api_keys' 
          // Note: no encrypted_value provided
        }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(false)
    })

    test('validates encrypted_value is not null or empty', () => {
      const ragCreds: NormalizedCredential[] = [
        { key: 'LLM_PROVIDER', value: 'openai', category: 'rag_strategy' }
      ]
      const apiKeyCreds: NormalizedCredential[] = [
        { 
          key: 'OPENAI_API_KEY', 
          is_encrypted: true, 
          encrypted_value: '', 
          category: 'api_keys' 
        }
      ]
      
      expect(isLmConfigured(ragCreds, apiKeyCreds)).toBe(false)
    })
  })
})