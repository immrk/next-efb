import { net } from "electron";

const baseURL = process.env.VITE_API_BASE_URL;

console.log("baseURL", baseURL);

export const netRequest = (option: any) => {
  const paramsString = Object.entries(option.params || {})
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const url = `${baseURL}${option.url}${paramsString ? `?${paramsString}` : ""}`;

  return new Promise((resolve, reject) => {
    const request = net.request({
      ...option,
      url,
    });

    let rawData = "";

    request.on("response", (response) => {
      response.on("data", (chunk) => {
        rawData += chunk;
      });

      response.on("end", () => {
        try {
          const parsedData = JSON.parse(rawData);
          if (response.statusCode !== 200) {
            reject({
              status: response.statusCode,
              data: parsedData,
            });
          } else {
            resolve(parsedData);
          }
        } catch (e) {
          reject({
            status: response.statusCode,
            data: rawData,
            error: e,
          });
        }
      });
    });

    request.on("error", (err) => {
      reject(err);
    });

    request.end();
  });
};
