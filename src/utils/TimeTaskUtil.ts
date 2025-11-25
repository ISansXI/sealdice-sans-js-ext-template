/**
 * 生成 cron 表达式的参数接口
 */
interface CronParams {
    /** 时间戳 (与 formattedTime 二选一) */
    timestamp?: number;
    /** 格式化时间字符串 (与 timestamp 二选一)，格式必须为 'yyyy-MM-dd hh:mm:ss' */
    formattedTime?: string;
    /** 是否重复执行。true 表示周期性重复，false 表示只执行一次。默认为 false。 */
    repeat?: boolean;
}

/**
 * 根据时间戳或格式化时间生成 cron 表达式
 * @param params 包含时间信息和重复设置的参数对象
 * @returns 生成的 cron 字符串
 * @example
 * // 生成一个一次性执行的 cron (2024年5月20日 13点14分0秒)
 * // 注意: 这依赖于 cron 实现支持年份字段
 * generateCronFromTime({
 *   formattedTime: '2024-05-20 13:14:00',
 *   repeat: false
 * });
 * // 返回: '0 14 13 20 5 2024'
 *
 * @example
 * // 生成一个每年重复执行的 cron
 * generateCronFromTime({
 *   formattedTime: '2024-05-20 13:14:00',
 *   repeat: true
 * });
 * // 返回: '0 14 13 20 5 *'
 */
function generateCronFromTime(params: CronParams): string {
    const { timestamp, formattedTime, repeat = false } = params;

    // 1. 参数校验：确保 timestamp 和 formattedTime 不同时提供
    if (timestamp !== undefined && formattedTime !== undefined) {
        throw new Error('参数 "timestamp" 和 "formattedTime" 只能提供一个');
    }

    // 2. 参数校验：确保至少提供一个时间参数
    if (timestamp === undefined && formattedTime === undefined) {
        throw new Error('必须提供 "timestamp" 或 "formattedTime" 中的一个');
    }

    let date: Date;

    // 3. 解析时间
    if (timestamp !== undefined) {
        if (typeof timestamp !== 'number' || isNaN(timestamp)) {
            throw new Error('"timestamp" 必须是一个有效的数字');
        }
        date = new Date(timestamp);
    } else {
        if (typeof formattedTime !== 'string') {
            throw new Error('"formattedTime" 必须是一个字符串');
        }
        const timeRegex = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/;
        const match = formattedTime.match(timeRegex);

        if (!match) {
            throw new Error('"formattedTime" 格式不正确，请使用 \'yyyy-MM-dd hh:mm:ss\' 格式');
        }

        const [, year, month, day, hour, minute, second] = match;
        date = new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1, // 注意：JS 的月份是 0-11
            parseInt(day, 10),
            parseInt(hour, 10),
            parseInt(minute, 10),
            parseInt(second, 10)
        );

        if (isNaN(date.getTime())) {
            throw new Error('"formattedTime" 包含一个无效的日期');
        }
    }

    // 4. 提取时间组件
    const second = date.getSeconds();
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1; // 转换为 1-12 的格式
    const year = date.getFullYear();

    // 5. 生成 cron 表达式
    // Cron 格式: 秒 分 时 日 月 星期 [年]
    // 当 repeat 为 false 时，加入年份，使其只执行一次
    // 当 repeat 为 true 时，年份用 *，使其每年重复
    const yearField = repeat ? '*' : year.toString();
    const cronExpression = `${second} ${minute} ${hour} ${dayOfMonth} ${month} * ${yearField}`;

    return cronExpression;
}

/**
 * 格式化数字，确保其为两位数（小于 10 则前面补 0）
 * @param num 需要格式化的数字
 * @returns 格式化后的两位数字符串
 */
function pad(num: number): string {
    return num < 10 ? `0${num}` : num.toString();
}

/**
 * 解析时间间隔字符串（如 "yyyy-MM-dd hh:mm:ss"）为毫秒数
 * @param durationStr 时间间隔字符串
 * @returns 对应的毫秒数
 */
function parseDurationString(durationStr: string): number {
    const timeRegex = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/;
    const match = durationStr.match(timeRegex);

    if (!match) {
        throw new Error('"duration" 字符串格式不正确，请使用 \'yyyy-MM-dd hh:mm:ss\' 格式');
    }

    const [, years, months, days, hours, minutes, seconds] = match;

    // 创建一个临时日期对象来计算月份和年份的差值
    // 注意：这种方法会自动处理闰年和不同月份的天数差异
    const now = new Date();
    const future = new Date(now);

    future.setFullYear(now.getFullYear() + parseInt(years, 10));
    future.setMonth(now.getMonth() + parseInt(months, 10));
    future.setDate(now.getDate() + parseInt(days, 10));
    future.setHours(now.getHours() + parseInt(hours, 10));
    future.setMinutes(now.getMinutes() + parseInt(minutes, 10));
    future.setSeconds(now.getSeconds() + parseInt(seconds, 10));

    const durationMs = future.getTime() - now.getTime();

    if (durationMs < 0) {
        throw new Error('"duration" 不能表示一个过去的时间');
    }

    return durationMs;
}

/**
 * 计算当前时间加上指定间隔后的格式化时间字符串
 * @param duration 时间间隔，可以是格式化字符串（"yyyy-MM-dd hh:mm:ss"）或毫秒数
 * @returns 格式化后的未来时间字符串（"yyyy-MM-dd hh:mm:ss"）
 * @example
 * // 使用字符串格式的 duration
 * getFutureTime("0000-00-01 02:30:00"); // 1天2小时30分钟
 * // 返回类似: "2024-05-21 16:00:00"
 *
 * @example
 * // 使用毫秒数格式的 duration (30分钟)
 * getFutureTime(30 * 60 * 1000);
 * // 返回类似: "2024-05-20 13:45:00"
 */
function getFutureTime(duration: string | number): string {
    let durationMs: number;

    if (typeof duration === 'string') {
        durationMs = parseDurationString(duration);
    } else if (typeof duration === 'number') {
        if (isNaN(duration) || duration < 0) {
            throw new Error('"duration" 数字必须是一个非负的有效数字');
        }
        durationMs = duration;
    } else {
        throw new Error('"duration" 必须是一个字符串或数字');
    }

    // 计算未来时间
    const now = new Date();
    const futureDate = new Date(now.getTime() + durationMs);

    // 提取时间组件并格式化
    const year = futureDate.getFullYear();
    const month = pad(futureDate.getMonth() + 1);
    const day = pad(futureDate.getDate());
    const hours = pad(futureDate.getHours());
    const minutes = pad(futureDate.getMinutes());
    const seconds = pad(futureDate.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 注册一个定时任务到指定的扩展。
 * 该任务可以基于特定的时间点（一次性）或周期性的 cron 表达式来执行。
 *
 * @param {seal.ExtInfo} ext - 扩展信息对象，指定任务要注册到哪个扩展。
 * @param {number} [timestamp] - 任务执行的时间戳（与 formattedTime 二选一）。
 *                               例如：`new Date('2024-05-20T13:14:00').getTime()`。
 *                               如果 `repeat` 为 false，此时间点即为任务唯一的执行时间。
 *                               如果 `repeat` 为 true，任务将从该时间点开始，按照其时间模式周期性执行。
 * @param {string} [formattedTime] - 任务执行的格式化时间字符串（与 timestamp 二选一），格式必须为 'yyyy-MM-dd hh:mm:ss'。
 *                                   例如：'2024-05-20 13:14:00'。
 *                                   其作用与 `timestamp` 参数类似，只是提供了更易读的方式来指定时间。
 * @param {boolean} [repeat=false] - 指示任务是否需要重复执行。
 *                                   - `true`: 任务将被设置为周期性执行。生成的 cron 表达式将不包含具体年份，
 *                                             因此会每年重复。例如，'14 13 20 5 *' 会在每年的 5月20日13:14执行。
 *                                   - `false`: 任务将只执行一次。生成的 cron 表达式将包含具体的年份，
 *                                              例如，'14 13 20 5 * 2024'。这依赖于 cron 解析器支持年份字段。
 * @param {Function} task - 当任务触发时需要执行的函数。这是任务的核心逻辑。
 * @param {string} [key] - 任务的唯一标识符。如果提供，后续可以通过此 key 来查找或取消该任务。
 * @param {string} [desc] - 任务的描述信息，用于说明任务的用途，方便后续维护和调试。
 *
 * @throws {Error} 如果 `timestamp` 和 `formattedTime` 同时被提供，将抛出错误。
 * @throws {Error} 如果 `timestamp` 和 `formattedTime` 都未被提供，将抛出错误。
 * @throws {Error} 如果 `formattedTime` 格式不正确，将由内部的 `generateCronFromTime` 函数抛出错误。
 * @throws {Error} 如果 `timestamp` 不是一个有效的数字，将由内部的 `generateCronFromTime` 函数抛出错误。
 *
 * @example
 * // 示例 1: 注册一个一次性任务（使用 formattedTime）
 * registerTimeTask(
 *   myExtension,
 *   undefined,
 *   '2024-12-31 23:59:59',
 *   false,
 *   () => {
 *     console.log('新年快乐！');
 *   },
 *   'newYearEveTask',
 *   '在2024年除夕执行的祝福任务'
 * );
 *
 * @example
 * // 示例 2: 注册一个周期性任务（使用 timestamp）
 * const birthday = new Date('2000-09-15T08:00:00').getTime();
 * registerTimeTask(
 *   myExtension,
 *   birthday,
 *   undefined,
 *   true,
 *   () => {
 *     console.log('生日快乐！');
 *   },
 *   'birthdayReminder',
 *   '每年生日当天早上8点发送祝福'
 * );
 */
function registerTimeTask(ext: seal.ExtInfo, timestamp: number, formattedTime: string, repeat: boolean = false, task: Function, key?:string, desc?:string) {
    // 1. 参数校验：确保 timestamp 和 formattedTime 不同时提供
    if (timestamp !== undefined && formattedTime !== undefined) {
        throw new Error('参数 "timestamp" 和 "formattedTime" 只能提供一个');
    }

    // 2. 参数校验：确保至少提供一个时间参数
    if (timestamp === undefined && formattedTime === undefined) {
        throw new Error('必须提供 "timestamp" 或 "formattedTime" 中的一个');
    }

    const cronText = generateCronFromTime({ timestamp : timestamp, formattedTime : formattedTime, repeat: repeat});

    seal.ext.registerTask(ext, "cron", cronText, task, key, desc);
}

export {
    getFutureTime,
    registerTimeTask,
    CronParams
}