function getCallerInfo(): string {
  const originalFunc = Error.prepareStackTrace;
  try {
    const err = new Error();
    const stack = err.stack?.split("\n");

    if (!stack || stack.length < 4) return "";

    // stack[3] 通常是调用 console.log 的地方
    const stackLine = stack[3];
    const match = stackLine.match(/\((.*):(\d+):(\d+)\)/);

    if (match) {
      const [, file, line, col] = match;
      const shortFile = file.split("/").slice(-2).join("/").split(".")[0]; // 只取最后两级路径
      const now = new Date();
      const time =
        now.toLocaleTimeString("zh-CN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) +
        "." +
        now.getMilliseconds().toString().padStart(3, "0");
      return `${shortFile}:${line}:${col} ${time}`;
    }

    return "";
  } catch (error) {
    return "";
  } finally {
    Error.prepareStackTrace = originalFunc;
  }
}

// 保存原始的 console.log 函数
const originalLog = console.log;

// 重写 console.log
console.log = (...args: unknown[]): void => {
  const callerInfo = getCallerInfo();
  originalLog(`[${callerInfo}]`, ...args);
};

const originalError = console.error;
console.error = (...args: unknown[]): void => {
  const callerInfo = getCallerInfo();
  originalError(`[${callerInfo}]`, ...args);
};

const originalWarn = console.warn;
console.warn = (...args: unknown[]): void => {
  const callerInfo = getCallerInfo();
  originalWarn(`[${callerInfo}]`, ...args);
};

const originalDebug = console.debug;
console.debug = (...args: unknown[]): void => {
  const callerInfo = getCallerInfo();
  originalDebug(`[${callerInfo}]`, ...args);
};
