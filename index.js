import "dotenv/config";
import { Bot, GrammyError, HttpError, InlineKeyboard, InputFile } from "grammy";
import { query, collection, getDocs, where } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { salaryReportCalculation, writingReportToFile } from "./helpers.js";

const bot = new Bot(process.env.BOT_API_KEY);

// База данных
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

bot.api.setMyCommands([
    { command: "id", description: "Мой ID" },
    { command: "reports", description: "Отчет о зарплате" },
]);

bot.command("start", async (ctx) => {
    await ctx.reply("Привет, чем могу помочь?");
});

bot.command("id", async (ctx) => {
    await ctx.reply(`Ваш ID: ${ctx.from.id}`);
});

const monthsKeyboard = new InlineKeyboard()
    .text("Август", "2024.7")
    .row()
    .text("Сентябрь", "2024.8")
    .row()
    .text("Октябрь", "2024.9")
    .row()
    .text("Ноябрь", "2024.10")
    .row()
    .text("Декабрь", "2024.11")
    .row()
    .text("Январь", "2025.0")
    .row()
    .text("Февраль", "2025.1");

bot.command("reports", async (ctx) => {
    await ctx.reply("За какой месяц?", {
        reply_markup: monthsKeyboard,
    });
});

// let isLimitRequest = false;
bot.on("callback_query:data", async (ctx) => {
    // if (isLimitRequest) {
    //     setTimeout(() => {
    //         isLimitRequest = false;
    //     }, 500);
    //     await ctx.reply("Превышен лимит нажатий в секунду.");
    //     await ctx.answerCallbackQuery();
    //     return;
    // }
    // isLimitRequest = true;

    try {
        const q = query(
            collection(db, "employees"),
            // where("isDismissed", "==", false),
            where("telegramID", "==", ctx.from.id)
        );
        const response = await getDocs(q);
        const result = response.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
        }));
        const employee = result[0];

        if (employee) {
            const report = salaryReportCalculation(
                employee.dates[ctx.callbackQuery.data],
                ctx.callbackQuery.data
            );

            if (report) {
                const folderName = writingReportToFile(report, employee.name);
                await ctx.replyWithDocument(new InputFile(folderName));
            } else {
                await ctx.reply("Не вижу, чтобы вы работали в этом месяце.");
            }
        } else {
            await ctx.reply(
                "Обратитесь к администратору, что-то пошло не так."
            );
        }
    } catch (err) {
        console.error(err);
    } finally {
        await ctx.answerCallbackQuery();
    }
});

// Обработка ошибок
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;

    if (e instanceof GrammyError) {
        console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown error:", e);
    }
});

bot.start();
