// Quick Ollama Integration Test
// Run: node test-ollama.js

const { Ollama } = require('ollama');

const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
const ollama = new Ollama({ host: ollamaHost });

async function testOllama() {
  console.log('🧪 Testing Ollama Integration...\n');
  console.log(`📍 Ollama endpoint: ${ollamaHost}\n`);

  try {
    // 1. Check connection and list models
    console.log('1️⃣  Checking Ollama connection...');
    const models = await ollama.list();
    console.log(`✅ Connected! Found ${models.models.length} model(s)`);
    console.log('📦 Available models:');
    models.models.forEach((m) => {
      const sizeGB = (m.size / 1024 / 1024 / 1024).toFixed(1);
      console.log(`   - ${m.name} (${sizeGB} GB)`);
    });
    console.log('');

    // 2. Check recommended models
    const recommended = ['qwen2.5:3b', 'codellama:7b', 'llava:latest'];
    console.log('2️⃣  Checking recommended models...');
    const loadedModels = models.models.map((m) => m.name);
    const missing = recommended.filter((m) => !loadedModels.includes(m));
    
    if (missing.length === 0) {
      console.log('✅ All recommended models are loaded!');
    } else {
      console.log(`⚠️  Missing models: ${missing.join(', ')}`);
      console.log('💡 Run: ollama pull <model-name> to download');
    }
    console.log('');

    // 3. Test text generation with qwen2.5:3b
    if (loadedModels.includes('qwen2.5:3b')) {
      console.log('3️⃣  Testing text generation (qwen2.5:3b)...');
      const startTime = Date.now();
      const response = await ollama.generate({
        model: 'qwen2.5:3b',
        prompt: 'Hello! Can you tell me a short joke?',
        stream: false,
      });
      const duration = Date.now() - startTime;
      
      console.log(`✅ Generated response in ${duration}ms:`);
      console.log(`   "${response.response.substring(0, 100)}..."`);
      console.log('');
    } else {
      console.log('3️⃣  Skipping text generation test (qwen2.5:3b not loaded)');
      console.log('');
    }

    // 4. Test code generation with codellama:7b
    if (loadedModels.includes('codellama:7b')) {
      console.log('4️⃣  Testing code generation (codellama:7b)...');
      const startTime = Date.now();
      const response = await ollama.generate({
        model: 'codellama:7b',
        prompt: 'Write a Python function to calculate fibonacci numbers',
        stream: false,
      });
      const duration = Date.now() - startTime;
      
      console.log(`✅ Generated code in ${duration}ms`);
      console.log(`   Preview: ${response.response.substring(0, 150)}...`);
      console.log('');
    } else {
      console.log('4️⃣  Skipping code generation test (codellama:7b not loaded)');
      console.log('');
    }

    // 5. Summary
    console.log('📊 Test Summary:');
    console.log(`   ✅ Ollama connection: Working`);
    console.log(`   ✅ Models loaded: ${loadedModels.length}`);
    console.log(`   ✅ Recommended models: ${recommended.length - missing.length}/${recommended.length}`);
    console.log('');
    console.log('🎉 Ollama integration test completed successfully!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Start the backend: cd worker && npm run dev');
    console.log('   2. Check health: curl http://localhost:3001/health');
    console.log('   3. Test AI endpoint: curl -X POST http://localhost:3001/api/ai/generate \\');
    console.log('      -H "Content-Type: application/json" \\');
    console.log('      -d \'{"prompt": "Hello!"}\'');

  } catch (error) {
    console.error('❌ Ollama integration test failed:');
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Make sure Ollama is running: ollama serve');
    console.error('   2. Check OLLAMA_HOST environment variable');
    console.error('   3. Verify network connectivity to Ollama');
    process.exit(1);
  }
}

testOllama();
