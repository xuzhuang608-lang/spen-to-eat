const fs = require("fs");
const https = require("https");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "miniprogram", "data", "national-cities.js");
const DOC = path.join(ROOT, "docs", "city-data-source.md");

const URLS = {
  province: "https://raw.githubusercontent.com/uiwjs/province-city-china/master/packages/core/dist/province.json",
  city: "https://raw.githubusercontent.com/uiwjs/province-city-china/master/packages/core/dist/city.json"
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          resolve(fetchJson(new URL(res.headers.location, url).toString()));
          return;
        }
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Request failed ${res.statusCode}: ${url}`));
            return;
          }
          resolve(JSON.parse(text));
        });
      })
      .on("error", reject);
  });
}

function normalizeProvinceName(name) {
  return name
    .replace("省", "")
    .replace("市", "")
    .replace("壮族自治区", "")
    .replace("回族自治区", "")
    .replace("维吾尔自治区", "")
    .replace("自治区", "")
    .replace("特别行政区", "");
}

function normalizeCityName(name) {
  return name
    .replace("藏族羌族自治州", "")
    .replace("蒙古族藏族自治州", "")
    .replace("哈尼族彝族自治州", "")
    .replace("傣族景颇族自治州", "")
    .replace("布依族苗族自治州", "")
    .replace("苗族侗族自治州", "")
    .replace("土家族苗族自治州", "")
    .replace("回族自治州", "")
    .replace("蒙古自治州", "")
    .replace("藏族自治州", "")
    .replace("彝族自治州", "")
    .replace("傣族自治州", "")
    .replace("白族自治州", "")
    .replace("傈僳族自治州", "")
    .replace("壮族苗族自治州", "")
    .replace("柯尔克孜自治州", "")
    .replace("自治州", "")
    .replace("地区", "")
    .replace("盟", "")
    .replace("市", "");
}

function provinceIdFromCityCode(code) {
  return `${String(code).slice(0, 2)}0000`;
}

function createSlogan(name) {
  return `${name}饭点灵感，等你来转。`;
}

function writeJs(provinces, cities) {
  const provinceByCode = new Map(provinces.map((item) => [String(item.code), item]));
  const directProvinceCodes = new Set(["110000", "120000", "310000", "500000", "710000", "810000", "820000"]);
  const normalizedProvinces = provinces.map((item) => {
    const shortName = normalizeProvinceName(item.name);
    return {
      id: String(item.code),
      name: shortName,
      fullName: item.name,
      sort: Number(item.code)
    };
  });

  const directCities = provinces
    .filter((item) => directProvinceCodes.has(String(item.code)))
    .map((item) => {
      const shortName = normalizeProvinceName(item.name);
      return {
        id: String(item.code),
        name: shortName,
        fullName: item.name,
        province: shortName,
        provinceFullName: item.name,
        provinceId: String(item.code),
        slogan: createSlogan(shortName)
      };
    });

  const prefectureCities = cities
    .map((item) => {
      const code = String(item.code);
      const province = provinceByCode.get(provinceIdFromCityCode(code));
      const provinceShortName = province ? normalizeProvinceName(province.name) : "";
      const cityShortName = normalizeCityName(item.name);
      return {
        id: code,
        name: cityShortName,
        fullName: item.name,
        province: provinceShortName,
        provinceFullName: province ? province.name : "",
        provinceId: province ? String(province.code) : "",
        slogan: createSlogan(cityShortName)
      };
    })
    .filter((item) => item.provinceId)
    .sort((a, b) => Number(a.id) - Number(b.id));

  const normalizedCities = directCities.concat(prefectureCities);

  const groupedProvinces = normalizedProvinces.map((province) => ({
    ...province,
    cities: normalizedCities.filter((city) => city.provinceId === province.id)
  }));

  const content = `// Generated from province-city-china GB/T 2260 data. Do not edit manually.\nconst provinces = ${JSON.stringify(groupedProvinces, null, 2)};\n\nconst cities = ${JSON.stringify(normalizedCities, null, 2)};\n\nmodule.exports = {\n  provinces,\n  cities\n};\n`;
  fs.writeFileSync(OUTPUT, content, "utf8");
}

function writeDoc(provinces, cityCount) {
  const content = `# 城市基础数据来源\n\n本项目全国城市基础数据来自开源项目 \`uiwjs/province-city-china\`，该项目说明其数据基于中华人民共和国国家标准 GB/T 2260 行政区划代码。\n\n- 省级数据：${URLS.province}\n- 地级城市数据：${URLS.city}\n- 项目主页：https://github.com/uiwjs/province-city-china\n\n当前导入范围：省级行政区 + 地级市/自治州/地区/盟/直辖市等地级城市数据。\n\n本次生成统计：\n\n- 省级行政区：${provinces.length}\n- 可选城市：${cityCount}\n\n说明：首版仅更新城市选择基础数据。城市特色美食内容仍需按城市逐步整理，不会自动生成全国美食内容。\n`;
  fs.writeFileSync(DOC, content, "utf8");
}

(async () => {
  const [provinces, cities] = await Promise.all([fetchJson(URLS.province), fetchJson(URLS.city)]);
  writeJs(provinces, cities);
  const generated = require(OUTPUT);
  writeDoc(provinces, generated.cities.length);
  console.log(JSON.stringify({ provinces: provinces.length, cities: generated.cities.length, output: OUTPUT }, null, 2));
})();
