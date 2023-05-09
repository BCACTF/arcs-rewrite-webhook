import { inspect } from 'util';
import getReqId, { getHandlerName } from './fast-req-id';


interface StackFrame {
    orig: string;
    name: string;
    aliasName?: string;
    pathPrefix?: string;
    path: string;
    pos?: [number, number];
}

const prefix = () => process.env.LOGGING_PREFIX_STRIP ?? "";
const formatPath = (pathUnstripped: string) => {
    const pathRaw = pathUnstripped;

    if (pathRaw.startsWith(prefix())) {
        const unprefixed = pathUnstripped.slice(prefix().length).replace(/^\//, "");
        return `./${unprefixed}`;
    } else {
        return pathRaw;
    }
}


const anonFnStackTraceLinkToStackFrame = (line: string): StackFrame | null => {
    const regex = /at (node\:)?([^):]+)(:\d+)?(:\d+)?/;
    const match = line.match(regex);
    if (!match) return null;

    const posRaw = [match[3], match[4]];
    const [lineRaw, colRaw] = [posRaw[0] ? parseInt(posRaw[0].slice(1)) : undefined, posRaw[1] ? parseInt(posRaw[1].slice(1)) : undefined] as const;
    const pos = lineRaw && colRaw ? [lineRaw, colRaw] as [number, number] : undefined;

    const pathUnstripped = match[2];formatPath(match[2])

    return {
        orig: line,
        name: "<anonymous>",
        aliasName: undefined,
        pathPrefix: match[1],
        path: formatPath(match[2]),
        pos,
    }
}
const stackTraceLineToStackFrame = (line: string): StackFrame | null => {
    const regex = /at ?([a-zA-Z_\$]+)(\.([a-zA-Z<>_$]+))* ?(\[as ([a-zA-Z<>_$]+)\])? ?\((node\:)?([^):]+)(:\d+)?(:\d+)?\)/;
    const match = line.match(regex);
    if (!match) return anonFnStackTraceLinkToStackFrame(line);
    const name = match[3] ?? match[1] ?? "<anonymous>";
    const aliasName = match[5];
    const pathPrefix = match[6];
    const posRaw = [match[8], match[9]];
    const [lineRaw, colRaw] = [posRaw[0] ? parseInt(posRaw[0].slice(1)) : undefined, posRaw[1] ? parseInt(posRaw[1].slice(1)) : undefined] as const;
    const pos = lineRaw && colRaw ? [lineRaw, colRaw] as [number, number] : undefined;

    const path = formatPath(match[7]);

    return {
        orig: line,
        name,
        aliasName,
        pathPrefix,
        path,
        pos,
    }
}
const getStackTrace = () => new Error().stack?.split("\n").slice(1).map(s => s.trim()).map(stackTraceLineToStackFrame);


enum ColorCode {
    MONTH_DAY = "38;5;147",
    HR_MN_SEC = "38;5;86",
    MILLISECS = "38;5;23",
    FUNC_NAME = "38;5;47",
    FUNC_PATH = "38;5;159",
    LINE_COLN = "38;5;159",
    REQUES_ID = "34",
    RESET = "0",
}

const levelBuild = (colorCode: string, name: string) => `\x1b[${colorCode}m${name.padEnd(5, " ")}\x1b[0m`
const level = {
    TRACE: levelBuild("35", "TRACE"),
    DEBUG: levelBuild("32", "DEBUG"),
    INFO:  levelBuild("36", "INFO"),
    WARN:  levelBuild("33", "WARN"),
    SECUR: levelBuild("43;1", "SECUR"),
    ERROR: levelBuild("31", "ERROR"),
}

const withColor = (color: ColorCode, text: string): string => `\x1b[${color}m${text}\x1b[0m`;

const loggingPrefix = (stack: StackFrame | null, level: string) => {
    const now = new Date();

    const monDayNoColor = `${
        now.toLocaleDateString(undefined, {month: "short"})
    } ${
        now.toLocaleDateString(undefined, {day: "2-digit"})
    }`;
    const hrMinSecNoColor = `${
        now.getHours().toString().padStart(2, "0")
    }:${
        now.getMinutes().toString().padStart(2, "0")
    }:${
        now.getSeconds().toString().padStart(2, "0")
    }`;
    const millisNoColor = `.${Math.floor(now.getTime() % 1000).toString().padStart(3, "0")}`;

    const time = `${
        withColor(ColorCode.MONTH_DAY, monDayNoColor)
    } ${
        withColor(ColorCode.HR_MN_SEC, hrMinSecNoColor)
    }${
        withColor(ColorCode.MILLISECS, millisNoColor)
    }`;

    const nameNoColor = stack?.aliasName ?? stack?.name ?? "<unknown>";
    const pathNoColor = stack?.path ?? "<unknown_path>";
    const locationNoColor = stack?.pos ? `:${stack.pos[0]}:${stack.pos[1]}` : "";

    const identifiers = `${
        withColor(ColorCode.FUNC_NAME, nameNoColor.padStart(20))
    } @ ${withColor(ColorCode.FUNC_PATH, `${pathNoColor}${locationNoColor}`.padEnd(50))}`;

    const idRaw = getReqId();
    const handlerRaw = getHandlerName();
    const innerBuilt = idRaw ? `${idRaw} ${handlerRaw ? handlerRaw : ''}`.trim() : '';
    const idStr = innerBuilt ? withColor(ColorCode.REQUES_ID, `<${innerBuilt}> `) : "";

    return `${time} -> ${identifiers}| ${level} - ${idStr}`;
};

const inspectValue = (v: unknown) => inspect(v, { breakLength: 60, depth: 8, colors: true });
const logText = (strings: TemplateStringsArray, other: unknown[]) => {
    const interspersed = strings.slice(0, -1).flatMap((s, idx) => [s, inspectValue(other[idx])]);
    const mapped = [...interspersed, strings.slice(-1)[0]];
    return mapped.reduce((currStr, newVal) => `${currStr}${newVal}`, "");
}

const makeLoggingFunction = (level: string) => (strings: TemplateStringsArray, ...other: unknown[]) => {
    const prefix = loggingPrefix(getStackTrace()?.[2] ?? null, level);
    console.log(`${prefix}${logText(strings, other)}`);
};

const trace = makeLoggingFunction(level.TRACE);
const debug = makeLoggingFunction(level.DEBUG);
const info = makeLoggingFunction(level.INFO);

const warn = makeLoggingFunction(level.WARN);
const secWarn = makeLoggingFunction(level.SECUR);
const error = makeLoggingFunction(level.ERROR);

export { trace, debug, info, warn, secWarn, error };

