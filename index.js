import "dotenv/config";
import fs from "node:fs";
import {Bot, GrammyError, HttpError, InlineKeyboard, InputFile} from "grammy";
import {query, collection, getDocs, where} from "firebase/firestore";
import {initializeApp} from "firebase/app";
import {getFirestore} from "firebase/firestore";

const bot = new Bot(process.env.BOT_API_KEY);

// База данных
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// const userIds = {
//     721766976: "oS3sjkyUVECsSPoFedLA", // Турал!
//     1051749926: "etWhY3LXmGm43jWVrZF8", // Иван!
//     // 721766976: "Sl8PfjAw00aAbqSbQKR8" // Раиля
//     5351249844: "8Akai94k4CfLubxMFQJL", // Татьяна
//     // 721766976: "0Fzk5F8HuzjjvoOQep6i" // Ильшат
//     // 721766976: "2dAXCXFsLwAcexSFLUFZ" // Адель
//     1320803731: "Qxf8WzwRQdq4YPYgGEjq", // Виталий!
//     788444685: "hFxGV7Z3qz5K38DCDVfG", // Руслан
//     5026950974: "kBjKFqggrdhVK7rcQFe0", // Наиль!
//     5144267815: "ofD5ddZPgV52qKIFCzvy" // Сергей
//     // 721766976: "wEzqghYRUZi5QWmXFdKl" // Айдар
// };

bot.api.setMyCommands([
    {command: "id", description: "Мой ID"},
    {command: "salary", description: "Отчет о зарплате"}
]);

bot.command("start", async (ctx) => {
    await ctx.reply("Привет, чем могу помочь?");
});

bot.command("id", async (ctx) => {
    await ctx.reply(`Ваш ID: ${ctx.from.id}`);
});

const monthsKeyboard = new InlineKeyboard()
    .text("Ноябрь", "2024.10")
    .row()
    .text("Октябрь", "2024.9")
    .row()
    .text("Сентябрь", "2024.8")
    .row()
    .text("Август", "2024.7");

bot.command("salary", async (ctx) => {
    await ctx.reply("За какой месяц?", {
        reply_markup: monthsKeyboard
    });
});

bot.on("callback_query:data", async (ctx) => {
    try {
        const q = query(
            collection(db, "employees"),
            where("isDismissed", "==", false),
            where("telegramID", "==", ctx.from.id)
        );
        const response = await getDocs(q);
        const result = response.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id
        }));
        const employee = result[0];

        if (employee) {
            const reportAllMonths = salaryReportCalculation(employee);

            const report = reportAllMonths.find(
                (rep) => rep.month.key === ctx.callbackQuery.data
            );

            if (report) {
                // Запись рапорта в файл
                let reportFile = `${employee.name}\n`;
                reportFile += `\n`;
                reportFile += `${report.month.date} - ${
                    employee.dates[ctx.callbackQuery.data].hoursWorkedPerMonth
                } ч.\n`;
                reportFile += `Оклад: ${report.month.monthSalary}\n`;
                reportFile += `По графику (${report.month.hours} ч.): ${report.month.salary}\n`;
                reportFile += `Переработка (${report.month.overtimeHours} ч.): ${report.month.overtime}\n`;
                reportFile += `Итого: ${report.month.total}\n`;

                try {
                    let folderName = `./reports/${ctx.from.id}/`;

                    if (!fs.existsSync(folderName)) {
                        fs.mkdirSync(folderName);
                    }

                    folderName += `${new Date()
                        .toDateString()
                        .replaceAll(/ /g, "_")}/`;

                    if (!fs.existsSync(folderName)) {
                        fs.mkdirSync(folderName);
                    }

                    folderName += `${report.month.date.replaceAll(
                        / - /g,
                        "_"
                    )}.txt`;
                    fs.writeFileSync(folderName, reportFile);
                    await ctx.replyWithDocument(new InputFile(folderName));
                } catch (err) {
                    console.error(err);
                }
            } else {
                await ctx.reply("Не вижу, чтобы вы работали в этом месяце.");
            }
        } else {
            await ctx.reply(
                "Обратитесь к администратору, ваш ID не зарегистрирован."
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

const MONTHS = [
    {name: "Январь", value: 0},
    {name: "Февраль", value: 1},
    {name: "Март", value: 2},
    {name: "Апрель", value: 3},
    {name: "Май", value: 4},
    {name: "Июнь", value: 5},
    {name: "Июль", value: 6},
    {name: "Август", value: 7},
    {name: "Сентябрь", value: 8},
    {name: "Октябрь", value: 9},
    {name: "Ноябрь", value: 10},
    {name: "Декабрь", value: 11}
];

const MONTHS_PARAMETERS = {
    2024.7: {
        workingDays: 22,
        appVersion: 1.1
    },
    2024.8: {
        workingDays: 21,
        appVersion: 1.1
    },
    2024.9: {
        workingDays: 23,
        appVersion: 1.1
    },
    "2024.10": {
        workingDays: 20,
        appVersion: 1.2
    }
};

function salaryReportCalculation(employee) {
    const report = [];

    for (const key in employee.dates) {
        const month = employee.dates[key];

        // Поддерживает ли месяц возможность отчета о зарплате
        if (!(MONTHS_PARAMETERS[key]?.appVersion >= 1.1)) continue;
        // if (!useCheckVersion.isDayOff(key)) continue;
        if (month.daysWorkedPerMonth === 0) continue;

        // Месячная зарплата
        let salary = 0;
        // Сверхурочные за месяц
        let overtime = 0;
        // Общая сумма за месяц
        let total = 0;
        // Количество рабочих часов в месяце
        let hours = 0;
        // Количество сверхурочных часов в месяце
        let overtimeHours = 0;
        // Количество рабочих дней в месяце
        // const numberWorkingDays = MONTHS_PARAMETERS[key].workingDays;
        const numberWorkingDays = 22;

        month.days.forEach((number) => {
            const day = month[number];

            if (
                day.isWorked &&
                month.salary > 0 &&
                day.overtimeWork >= 0 &&
                day.overtimeRatio > 0
            ) {
                // Стоимость одного часа работы
                const costOfOneHourOfWork =
                    month.salary / numberWorkingDays / day.workShift;
                // Стоимость одного часа сверхурочной работы
                const costHourOvertimeWork =
                    costOfOneHourOfWork * day.overtimeRatio;

                // Подсчет зарплаты
                if (day.dayOfTheWeek === "Сб" || day.dayOfTheWeek === "Вс") {
                    overtimeHours += day.hoursWorkedPerDay;
                    overtime += costHourOvertimeWork * day.hoursWorkedPerDay;
                } else {
                    // console.log("day.hoursWorkedPerDay", day.hoursWorkedPerDay);
                    // console.log("day.overtimeWork", day.overtimeWork);

                    hours += day.hoursWorkedPerDay - day.overtimeWork;
                    overtimeHours += day.overtimeWork;
                    salary +=
                        costOfOneHourOfWork *
                        (day.hoursWorkedPerDay - day.overtimeWork);
                    overtime += costHourOvertimeWork * day.overtimeWork;
                }

                total = salary + overtime;
            }
        });

        report.push({
            month: {
                date: modifyDate(key),
                salary: salary.toFixed(2),
                overtime: overtime.toFixed(2),
                total: total.toFixed(2),
                monthSalary: month.salary,
                numberWorkingDays,
                hours,
                overtimeHours,
                key
            },
            employeeId: employee.id
        });
    }

    return report;
}

function modifyDate(date) {
    if (date) {
        const index = +date.slice(5);
        return `${date.slice(0, 4)} - ${MONTHS[index].name}`;
    }
}
