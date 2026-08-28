# Contributing

Thanks for looking. This is early - the fastest way to help is to try it and
tell me where it lied to you.

## Getting set up

```bash
npm install
npm run dev
npm test
```

## The rules that are not negotiable

1. **The page makes no network requests after load.** This is the product. A
   dependency that phones home is not merged, however useful it is.
2. **No analytics, no CDN fonts, no error reporting.**
3. **Nothing is persisted unless the user asks for it.**
4. **Large files stream.** Never read a whole file into one buffer.

Each of these has tests behind it. If you find yourself editing those tests to
make a change pass, stop and reconsider the change.

## Pull requests

- One change per pull request.
- A bug fix comes with the test that would have caught it.
- Run the checks before pushing; CI runs the same ones.
