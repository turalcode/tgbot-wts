import fs from "node:fs";
import { MONTHS, MONTHS_PARAMETERS } from "./constants.js";

export function salaryReportCalculation(month, key) {
    // Поддерживает ли месяц возможность отчета о зарплате
    if (!(MONTHS_PARAMETERS[key]?.appVersion >= 1.1)) return;
    if (!month || month.daysWorkedPerMonth === 0) return;

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
    const numberWorkingDays = 22;

    function modifyDate(date) {
        if (date) {
            const index = +date.slice(5);
            return `${date.slice(0, 4)} - ${MONTHS[index].name}`;
        }
    }

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
            if (day?.isDayOff || day.dayOfTheWeek === "Сб" || day.dayOfTheWeek === "Вс") {
                overtimeHours += day.hoursWorkedPerDay;
                overtime += costHourOvertimeWork * day.hoursWorkedPerDay;
            } else {
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

    return {
        date: modifyDate(key),
        salary: salary.toFixed(2),
        overtime: overtime.toFixed(2),
        total: total.toFixed(2),
        monthSalary: month.salary,
        hoursWorkedPerMonth: month.hoursWorkedPerMonth,
        numberWorkingDays,
        hours,
        overtimeHours,
        key,
    };
}

export function writingReportToFile(report, employeeName) {
    const costHourWork = (report.monthSalary / 22 / 8).toFixed(2);
    const costHourOvertimeWork = ((report.monthSalary / 22 / 8) * 1.25).toFixed(
        2
    );

    let reportFile = `${employeeName}\n`;
    reportFile += `\n`;
    reportFile += `Оплата в час: ${costHourWork} руб.\n`;
    reportFile += `Оплата в час (переработка): ${costHourOvertimeWork} руб.\n`;
    reportFile += `\n`;
    reportFile += `${report.date}\n`;
    reportFile += `\n`;
    reportFile += `По графику - ${report.hours}ч: ${report.salary} руб.\n`;
    reportFile += `Переработка - ${report.overtimeHours}ч: ${report.overtime} руб.\n`;
    reportFile += `Всего - ${report.hoursWorkedPerMonth}ч: ${report.total} руб.\n`;

    try {
        let folderName = `./reports/${new Date()
            .toDateString()
            .toLowerCase()
            .replaceAll(/ /g, "_")}/`;

        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName);
        }

        folderName += `${report.date.replaceAll(/ - /g, "_")}.txt`;
        fs.writeFileSync(folderName, reportFile);
        return folderName;
    } catch (err) {
        console.error(err);
    }
}
