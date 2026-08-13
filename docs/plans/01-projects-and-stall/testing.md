# Testing

Back: [overview](overview.md)

## Static

- `npx vitest run src/todoCommands.test.js src/todoStore.test.js src/todoRemote.test.js src/viewModes.test.js`
- `npm run verify:push:web` before each PR push

## Runtime

- `npm run test:ui`
- Local `npm run dev` driven with `control-ui`
- Confirm Projects is absent from Board Stall
- Confirm Stall still parks a started task without making it a project
