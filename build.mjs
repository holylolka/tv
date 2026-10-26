// Собирает JSON-файлы стартового экрана MSX в папку msx/.
// Запускается GitHub Actions каждый час (погода) и при каждом изменении репозитория.
// Локально: node build.mjs  (адрес сайта берётся из SITE_URL или из имени владельца репозитория)
import { readdirSync, writeFileSync, existsSync } from "node:fs";

const CITY = { name: "Иркутск", lat: 52.2978, lon: 104.2964, tz: "Asia/Irkutsk" };
const GREETING = "Привет";

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const SITE = (process.env.SITE_URL || (owner ? `https://${owner.toLowerCase()}.github.io` : "http://localhost:8080")).replace(/\/$/, "");
const MSX = `${SITE}/msx`;

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEKDAYS_FULL = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// Коды погоды WMO -> [описание, иконка Material]
function describe(code, isDay = 1) {
  if (code === 0) return ["Ясно", isDay ? "wb-sunny" : "brightness-3"];
  if (code === 1) return ["Малооблачно", isDay ? "wb-sunny" : "brightness-3"];
  if (code === 2) return ["Переменная облачность", "filter-drama"];
  if (code === 3) return ["Пасмурно", "cloud"];
  if (code === 45 || code === 48) return ["Туман", "blur-on"];
  if (code >= 51 && code <= 57) return ["Морось", "grain"];
  if (code === 61) return ["Небольшой дождь", "grain"];
  if (code === 63) return ["Дождь", "grain"];
  if (code === 65) return ["Сильный дождь", "grain"];
  if (code === 66 || code === 67) return ["Ледяной дождь", "grain"];
  if (code === 71) return ["Небольшой снег", "ac-unit"];
  if (code === 73) return ["Снег", "ac-unit"];
  if (code === 75) return ["Сильный снег", "ac-unit"];
  if (code === 77) return ["Снежная крупа", "ac-unit"];
  if (code >= 80 && code <= 82) return ["Ливень", "grain"];
  if (code === 85 || code === 86) return ["Снегопад", "ac-unit"];
  if (code === 95) return ["Гроза", "flash-on"];
  if (code === 96 || code === 99) return ["Гроза с градом", "flash-on"];
  return ["—", "cloud"];
}

const deg = (t) => {
  const v = Math.round(t);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}°`;
};
const dayOf = (iso) => new Date(`${iso}T12:00:00Z`);
const shortDate = (iso) => { const d = dayOf(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

async function weather() {
  const q = new URLSearchParams({
    latitude: CITY.lat, longitude: CITY.lon, timezone: CITY.tz, wind_speed_unit: "ms", forecast_days: "7",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  });
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.error("Погода недоступна:", e.message);
    return null;
  }
}

function write(name, obj) {
  writeFileSync(`msx/${name}`, JSON.stringify(obj, null, 2) + "\n");
}

function photoList() {
  if (!existsSync("photos")) return [];
  return readdirSync("photos")
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort()
    .map((f) => `${SITE}/photos/${encodeURIComponent(f)}`);
}

const w = await weather();
const photos = photoList();

// --- start.json: то, что телевизор загружает первым ---
write("start.json", {
  name: "Мой экран",
  version: "1.0.0",
  parameter: `menu:${MSX}/menu.json`,
});

// --- menu.json ---
write("menu.json", {
  headline: GREETING,
  background: `${SITE}/img/bg.jpg`,
  transparent: 1,
  style: "overlay",
  cache: false,
  extension: "{ico:msx-white:schedule} {now:time:hh:mm}",
  menu: [
    { icon: "home", label: "Главная", data: `${MSX}/home.json` },
    { icon: "filter-drama", label: "Погода", data: `${MSX}/forecast.json` },
    { icon: "photo-library", label: "Фото", data: `${MSX}/photos.json` },
  ],
});

// --- home.json: главный экран ---
const home = [];

const today = w ? dayOf(w.daily.time[0]) : null;
home.push({
  type: "space",
  layout: "0,0,8,2",
  headline: `{txt:msx-white:${GREETING}!}`,
  text: [
    today ? `${WEEKDAYS_FULL[today.getUTCDay()]}, ${shortDate(w.daily.time[0])}{br}` : "",
    "{ico:msx-white:schedule} {txt:msx-white:{now:time:hh:mm}}",
  ].join(""),
});

if (w) {
  const c = w.current;
  const [desc, icon] = describe(c.weather_code, c.is_day);
  home.push({
    type: "space",
    layout: "8,0,4,3",
    color: "msx-glass",
    headline: `{ico:msx-white:${icon}} ${CITY.name}`,
    text: [
      `{txt:msx-white:${deg(c.temperature_2m)}} ${desc}{br}`,
      `Ощущается как ${deg(c.apparent_temperature)}{br}`,
      `Ветер ${Math.round(c.wind_speed_10m)} м/с · Влажность ${c.relative_humidity_2m}%{br}{br}`,
      `{txt:msx-white-soft:Обновлено ${c.time.slice(11, 16)}}`,
    ].join(""),
  });
  for (let i = 0; i < 4; i++) {
    const [d, ic] = describe(w.daily.weather_code[i]);
    const label = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : WEEKDAYS[dayOf(w.daily.time[i]).getUTCDay()];
    home.push({
      type: "space",
      layout: `${i * 2},2,2,1`,
      color: "msx-glass",
      headline: `{ico:msx-white:${ic}} ${label}`,
      text: `${deg(w.daily.temperature_2m_max[i])} / ${deg(w.daily.temperature_2m_min[i])}`,
    });
  }
} else {
  home.push({
    type: "space",
    layout: "8,0,4,3",
    color: "msx-glass",
    headline: `{ico:msx-white:cloud-off} ${CITY.name}`,
    text: "Погода временно недоступна",
  });
}

home.push(
  {
    type: "default",
    layout: "0,3,4,3",
    color: "msx-glass",
    focus: true,
    icon: "movie",
    title: "Lampa",
    titleFooter: "Фильмы и сериалы",
    action: "link:http://lampa.mx",
  },
  {
    type: "default",
    layout: "4,3,4,3",
    color: "msx-glass",
    icon: "photo-library",
    title: "Фото",
    titleFooter: photos.length ? `${photos.length} шт.` : "Пока пусто",
    action: `content:${MSX}/photos.json`,
  },
  {
    type: "default",
    layout: "8,3,4,3",
    color: "msx-glass",
    icon: "filter-drama",
    title: "Погода",
    titleFooter: "На 7 дней",
    action: `content:${MSX}/forecast.json`,
  },
);

write("home.json", { cache: false, headline: "Главная", pages: [{ items: home }] });

// --- forecast.json: прогноз на неделю ---
write("forecast.json", {
  cache: false,
  type: "list",
  headline: `Погода · ${CITY.name}`,
  template: { type: "default", layout: "0,0,6,1", color: "msx-glass", enumerate: false },
  items: w
    ? w.daily.time.map((iso, i) => {
        const [d, ic] = describe(w.daily.weather_code[i]);
        const wd = WEEKDAYS[dayOf(iso).getUTCDay()];
        return {
          icon: ic,
          titleHeader: `${i === 0 ? "Сегодня" : i === 1 ? "Завтра" : wd}, ${shortDate(iso)}`,
          title: `${deg(w.daily.temperature_2m_max[i])} / ${deg(w.daily.temperature_2m_min[i])}`,
          titleFooter: `${d} · осадки ${w.daily.precipitation_probability_max[i] ?? 0}%`,
        };
      })
    : [{ type: "space", layout: "0,0,12,1", text: "Погода временно недоступна" }],
});

// --- photos.json: всё из папки photos/ ---
write("photos.json", {
  type: "pages",
  headline: "Фото",
  template: { type: "default", layout: "0,0,3,2", color: "msx-glass", imageFiller: "cover", action: "image:context" },
  items: photos.length
    ? photos.map((url) => ({ image: url }))
    : [{
        type: "space",
        layout: "0,0,12,2",
        color: "msx-glass",
        headline: "{ico:msx-white:photo-library} Здесь будут ваши фото",
        text: "Положите файлы .jpg или .png в папку photos репозитория — через пару минут они появятся на экране.",
      }],
});

console.log(`Готово: ${SITE}, фото: ${photos.length}, погода: ${w ? "есть" : "нет"}`);
