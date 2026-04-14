import { config } from "./config.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`API server listening on port ${config.PORT}`);
});
