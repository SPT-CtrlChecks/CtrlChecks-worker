# Test Setup Instructions

## Quick Start

1. **Install Dependencies:**
   ```bash
   cd worker
   npm install
   ```

2. **Run Tests:**
   ```bash
   npm test
   ```

## TypeScript Configuration

The project uses separate TypeScript configurations:
- `tsconfig.json` - For production builds (no Jest types)
- Jest automatically adds Jest types when running tests via `ts-jest`

## Troubleshooting

### Error: "Cannot find name 'describe'"
**Solution:** Make sure you've run `npm install` to install `@types/jest`

### Error: "Cannot find type definition file for 'jest'"
**Solution:** 
1. Run `npm install` to install dependencies
2. Verify `@types/jest` is in `node_modules/@types/jest`

### Tests not running
**Solution:**
1. Check that `jest` and `ts-jest` are installed: `npm list jest ts-jest`
2. Verify test files are in `src/**/__tests__/**/*.test.ts`
3. Run `npm test` from the `worker` directory

## Test Commands

- `npm test` - Run all tests
- `npm run test:watch` - Watch mode
- `npm run test:coverage` - Generate coverage report
