require("dotenv/config")
const express = require("express");
const ejs = require("ejs");
const chromium = require("@sparticuz/chromium");
const puppeteerCore = require("puppeteer-core")
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
        const nutritionComparisonBeforeValues = Object.values(data.nutritionComparison.before)
        const nutritionComparisonAfterValues = Object.values(data.nutritionComparison.after)
        const title = nutritionTranslations[data.language]
        res.render("recipe.ejs", { recipe: data, title, nutritionComparisonBeforeValues, nutritionComparisonAfterValues })
    } catch (error) {
        console.log(error)
    }
})



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
        if (!recipe) {
            return res.status(400).json({
                message: "recipe is required",
            });
        }
        const nutritionComparisonBeforeValues = Object.values(data.nutritionComparison.before)
        const nutritionComparisonAfterValues = Object.values(data.nutritionComparison.after)
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

        await page.addStyleTag({
            path: path.join(__dirname, "public/styles/css/style.css")
        });


        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true
        });

        await browser.close();


        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${recipe.dish}.pdf`,
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
