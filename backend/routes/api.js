import { Router } from "express";
import { generatePdf, progressSSE } from "../controllers/pdfController.js";

const router = Router();

router.get("/api/progress/:id", progressSSE);
router.post("/api/generate-pdf", generatePdf);

export default router;
