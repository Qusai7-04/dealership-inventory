import app from './app.js';
import { assertAuthConfig } from './auth.js';

const port = Number(process.env.PORT ?? 3000);

assertAuthConfig();

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
