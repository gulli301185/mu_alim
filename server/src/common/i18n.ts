import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/** Site UI languages. Messages in the code are written in Kyrgyz; `ru` gets
 * a translation from the dictionary below when one exists. */
export type Lang = 'kg' | 'ru';

const langStorage = new AsyncLocalStorage<Lang>();

/** The client sends the site's selected language as `Accept-Language`. */
export function langFromRequest(req: Pick<Request, 'headers'>): Lang {
  const header = req.headers['accept-language'];
  const value = (Array.isArray(header) ? header[0] : header) ?? '';
  return value.trim().toLowerCase().startsWith('ru') ? 'ru' : 'kg';
}

/**
 * Express middleware: makes the request's language available via
 * `currentLang()`, and translates a top-level `message` in JSON responses
 * (success messages such as "password changed"). Error bodies are
 * translated in AllExceptionsFilter.
 */
export function langMiddleware(req: Request, res: Response, next: NextFunction) {
  const lang = langFromRequest(req);
  if (lang === 'ru') {
    const json = res.json.bind(res);
    res.json = (body?: unknown) => {
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const { message } = body as { message?: unknown };
        if (typeof message === 'string') return json({ ...body, message: translateMessage(message, lang) });
      }
      return json(body);
    };
  }
  langStorage.run(lang, next);
}

export function currentLang(): Lang {
  return langStorage.getStore() ?? 'kg';
}

/**
 * Russian versions of user-facing messages, keyed by the exact Kyrgyz text
 * used in the code. Q&A and admin-only messages are intentionally left out
 * (those parts of the site stay Kyrgyz-only), so they fall through unchanged.
 */
const RU: Record<string, string> = {
  // Generic
  'Маалымат туура эмес': 'Неверные данные',
  'Сервер катасы': 'Ошибка сервера',
  'Сурам туура эмес': 'Неверный запрос',
  'Жараксыз параметрлер': 'Недопустимые параметры',
  'Кирүү талап кылынат': 'Требуется вход',
  'Жараксыз токен': 'Недействительный токен',
  'Колдонуучу аккаунту керек': 'Требуется аккаунт пользователя',
  'Админ укугу керек': 'Требуются права администратора',

  // Auth
  'Код телефонуңузга SMS менен жөнөтүлдү.': 'Код отправлен на ваш телефон по SMS.',
  'Код почтаңызга жөнөтүлдү. Почтаңызды текшериңиз.': 'Код отправлен на вашу почту. Проверьте почту.',
  'Код жараксыз же мөөнөтү өткөн': 'Код недействителен или срок его действия истёк',
  'Электрондук почта же сыр сөз туура эмес': 'Неверная электронная почта или пароль',
  'Админ үчүн /admin/login баракчасын колдонуңуз': 'Администраторам: используйте страницу /admin/login',
  'Аккаунт ырастала элек. Почтадагы кодду киргизиңиз.': 'Аккаунт не подтверждён. Введите код из письма.',
  'Админ укугу жок': 'Нет прав администратора',
  'Бул электрондук почта менен аккаунт бар': 'Аккаунт с этой почтой уже существует',
  'Бул телефон менен аккаунт бар': 'Аккаунт с этим телефоном уже существует',
  'Бул почта менен аккаунт жок': 'Аккаунт с этой почтой не найден',
  'Код почтага жөнөтүлгөн жок. Кийинчерээк кайра кайталап көрүңүз.':
    'Не удалось отправить код на почту. Попробуйте позже.',
  'Код почтага жөнөтүлгөн жок. Почта сервиси туташа элек.':
    'Не удалось отправить код: почтовый сервис не подключён.',
  'Сыр сөз ийгиликтүү өзгөртүлдү': 'Пароль успешно изменён',
  'Эгер бул почта менен ырастала элек аккаунт болсо, ага код жөнөтүлдү.':
    'Если с этой почтой есть неподтверждённый аккаунт, на неё отправлен код.',
  'Колдонуучу табылган жок': 'Пользователь не найден',
  'Бул электрондук почта ээсе болгон': 'Эта электронная почта уже занята',
  'Учурдагы сыр сөз туура эмес': 'Неверный текущий пароль',

  // Auth form validation (lib/auth-validation.ts)
  'Сыр сөз кеминде 8 символдон турушу керек': 'Пароль должен содержать не менее 8 символов',
  'Сыр сөз өтө узун': 'Пароль слишком длинный',
  'Сыр сөздө жок дегенде бир тамга болушу керек': 'Пароль должен содержать хотя бы одну букву',
  'Сыр сөздө жок дегенде бир сан болушу керек': 'Пароль должен содержать хотя бы одну цифру',
  'Электрондук почтаны толтуруңуз': 'Укажите электронную почту',
  'Электрондук почта өтө узун': 'Электронная почта слишком длинная',
  'Электрондук почта туура эмес. Мисалы: aty@gmail.com':
    'Неверная электронная почта. Например: name@gmail.com',
  'Электрондук почта туура эмес': 'Неверная электронная почта',
  'Телефон номерин толтуруңуз': 'Укажите номер телефона',
  'Телефон туура эмес. Мисалы: +996 700 123 456': 'Неверный телефон. Например: +996 700 123 456',
  'Сыр сөздү киргизиңиз': 'Введите пароль',
  'Аты кеминде 2 тамгадан турушу керек': 'Имя должно содержать не менее 2 букв',
  'Аты өтө узун': 'Имя слишком длинное',
  'Атта тек тамгалар болушу керек': 'Имя должно содержать только буквы',
  'Фамилия кеминде 2 тамгадан турушу керек': 'Фамилия должна содержать не менее 2 букв',
  'Фамилия өтө узун': 'Фамилия слишком длинная',
  'Фамилияда тек тамгалар болушу керек': 'Фамилия должна содержать только буквы',
  'Код 6 сандан турушу керек': 'Код должен состоять из 6 цифр',
  'Сыр сөздү кайталаңыз': 'Повторите пароль',
  'Сыр сөздөр дал келген жок': 'Пароли не совпадают',
  'Жаңы сыр сөз үчүн учурдагы сыр сөз керек': 'Для нового пароля нужен текущий пароль',

  // Courses, lessons, progress, tests
  'Курс табылган жок': 'Курс не найден',
  'Курс ачыла элек': 'Курс ещё не открыт',
  'Сабак табылган жок': 'Урок не найден',
  'Мурунку сабакты бүтүрүңүз': 'Завершите предыдущий урок',
  'Курс сабактары жок': 'В курсе нет уроков',
  'Бардык сабактарды бүтүрүңүз': 'Завершите все уроки',
  'Бул курста тест жок, сертификат берилбейт': 'В этом курсе нет теста, сертификат не выдаётся',
  'Тест табылган жок': 'Тест не найден',
  'Тесттен 3 жолу өтпөдүңүз. Даярданып, кайрадан тест тапшырыңыз.':
    'Вы не прошли тест 3 раза. Подготовьтесь и попробуйте снова.',

  // Reviews
  'Рейтинг 1–5 болушу керек': 'Оценка должна быть от 1 до 5',
  'Пикир табылган жок': 'Отзыв не найден',
  'Текст же видео керек': 'Нужен текст или видео',
  'Курс, отзыв жазган адамдын аты жана текст же видео керек':
    'Нужны курс, имя автора отзыва и текст или видео',
  'mp4, m4v, webm же mov видео керек': 'Нужно видео в формате mp4, m4v, webm или mov',
  'Видео файлы өтө чоң': 'Видеофайл слишком большой',
  'Видео файлы бош': 'Видеофайл пустой',

  // "Ask the teacher" form on the homepage (the Q&A pages themselves stay Kyrgyz)
  'Аты-жөнү керек': 'Укажите имя и фамилию',
  'Суроо кыска': 'Вопрос слишком короткий',
};

/** Messages with a variable part. */
const RU_PATTERNS: [RegExp, string][] = [
  [/^(\d+)-суроо жөнөтүлдү\. Жакынкы арада жооп беребиз\.$/, 'Вопрос №$1 отправлен. Скоро ответим.'],
  [
    /^Сертификат алуу үчүн курстук тестти (\d+)% жана андан жогору тапшырыңыз$/,
    'Чтобы получить сертификат, сдайте тест курса на $1% и выше',
  ],
];

export function translateMessage(message: string, lang: Lang = currentLang()): string {
  if (lang !== 'ru') return message;
  const exact = RU[message];
  if (exact) return exact;
  for (const [pattern, replacement] of RU_PATTERNS) {
    if (pattern.test(message)) return message.replace(pattern, replacement);
  }
  return message;
}

/** Translates the `error` text and per-field `fields` messages of an error body. */
export function translateErrorBody<T extends Record<string, unknown>>(body: T, lang: Lang): T {
  if (lang !== 'ru') return body;
  const out: Record<string, unknown> = { ...body };
  if (typeof out.error === 'string') out.error = translateMessage(out.error, lang);
  if (out.fields && typeof out.fields === 'object') {
    out.fields = Object.fromEntries(
      Object.entries(out.fields as Record<string, unknown>).map(([key, value]) => [
        key,
        typeof value === 'string' ? translateMessage(value, lang) : value,
      ]),
    );
  }
  return out as T;
}
