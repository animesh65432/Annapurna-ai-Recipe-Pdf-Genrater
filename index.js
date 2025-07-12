require("dotenv/config")
const express = require("express");
const fs = require("fs")
const ejs = require("ejs");
const chromium = require("@sparticuz/chromium");
const puppeteerCore = require("puppeteer-core")
const puppeteer = require("puppeteer")
const path = require("path");
const cors = require("cors");
const data = require("./data.json")
const axios = require("axios")
const { nutritionTranslations } = require("./utils")

const app = express();

console.log(process.env.BACKEND_URL)

app.set("views", path.resolve(__dirname, "./views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "/public/styles")));
app.set("view engine", "ejs");
app.use(cors({ origin: ["http://localhost:5173", "https://annapurna-ai.tech", `${process.env.BACKEND_URL}`, "http://localhost:8000"] }));
app.use(express.json());

app.get("/recipe", async (req, res) => {
    try {
        // Replace `data` with actual recipe data
        const recipe = data;

        const nutritionComparisonBeforeValues = Object.values(recipe.nutritionComparison.before);
        const nutritionComparisonAfterValues = Object.values(recipe.nutritionComparison.after);
        const title = nutritionTranslations[recipe.language];

        // Render EJS template to HTML string
        const html = await ejs.renderFile(
            path.join(__dirname, "./views/recipe.ejs"),
            { recipe, title, nutritionComparisonBeforeValues, nutritionComparisonAfterValues }
        );

        // Launch Puppeteer
        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        // Set HTML content
        await page.setContent(html, { waitUntil: "networkidle0" });

        // Add CSS (recommended to inline to avoid loading issues)
        const cssPath = path.join(__dirname, "public/styles/css/style.css");
        const cssContent = fs.readFileSync(cssPath, "utf8");
        await page.addStyleTag({ content: cssContent });

        // Optional: Debug screenshot
        // await page.screenshot({ path: "debug.png" });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
        });

        await browser.close();

        // Send as PDF download
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${recipe.dish.replace(/\s+/g, "_")}.pdf`,
            "Content-Length": pdfBuffer.length,
        });

        return res.send(pdfBuffer);

    } catch (error) {
        console.error("Error generating PDF:", error);
        return res.status(500).json({ message: "Failed to generate recipe PDF." });
    }
});





app.post("/genereaterecipePdf/:id", async (req, res) => {
    try {
        const { id } = req.params
        console.log(id)

        if (!id) {
            return res.status(400).json({
                message: "id is required"
            })
        }
        const reponse = await axios.get(`${process.env.BACKEND_URL}/recipe/GetRecipe?id=${id}`)
        const recipe = reponse?.data
        console.log(recipe)
        if (!recipe) {
            return res.status(400).json({
                message: "recipe is required",
            });
        }


        const nutritionComparisonBeforeValues = Object.values(recipe.nutritionComparison.before)
        const nutritionComparisonAfterValues = Object.values(recipe.nutritionComparison.after)
        const title = nutritionTranslations[recipe.language]


        const html = await ejs.renderFile(
            path.join(__dirname, "./views/recipe.ejs"),
            { recipe, title, nutritionComparisonBeforeValues, nutritionComparisonAfterValues }
        );

        const browser = await puppeteerCore.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless
        });

        const page = await browser.newPage();

        await page.setContent(html, { waitUntil: "networkidle0" });

        const cssPath = path.join(__dirname, "public/styles/css/style.css");
        const cssContent = fs.readFileSync(cssPath, "utf8");
        await page.addStyleTag({ content: cssContent });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
        });

        await browser.close();



        const safeDishName = recipe.dish.replace(/[^a-z0-9_\-]/gi, "_"); // replaces all non-safe chars
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${safeDishName}.pdf"`,
            "Content-Length": pdfBuffer.length,
        });

        return res.send(pdfBuffer);

    } catch (error) {
        console.error("PDF generation error:", error);
        return res.status(500).json({ message: "Failed to generate PDF" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
