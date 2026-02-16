import express from "express";
import "dotenv/config";
import { corsMiddleware } from "./middleware/corsConfig.js";
import apiRoutes from "./routes/api.js";

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(corsMiddleware);
app.use(express.json());

// Routes
app.use(apiRoutes);

// Local dev server
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`ChestNumbers Backend running on port ${PORT}`);
  });
}

export default app;
