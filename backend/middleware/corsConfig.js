const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://chest-numbers-fa.vercel.app",
];

export const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
};
