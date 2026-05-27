/* Чапаева 17 — контент-конфиг.
   Правится без изменения разметки: акции, направления, команда, FAQ.
   Когда появятся точные цены — меняем isTbd: true → false и проставляем price. */
window.CH17_DATA = (function () {
  'use strict';

  /* --------------------------------------------------------
     АКЦИИ
     marquee  — короткий текст для бегущей строки ({N} = текущее
                значение счётчика акции из counterRef)
     остальные поля — для карточки в блоке «Не упусти».
     Карточка рендерится только если active && есть title.
     ctaAction: scroll-to-prices | scroll-to-form | open-direct
  -------------------------------------------------------- */
  var promos = [
    {
      id: 'spring20',
      active: true,
      hot: false,
      marquee: '−20% на знакомство · первым 20 клиентам',
      tag: 'Знакомство',
      title: '−20% на первое занятие',
      emphasis: '−20%',
      description: 'Скидка на пробное для первых 20 клиентов студии. Хороший повод познакомиться с залом и тренером.',
      counter: null,
      meta: 'Первым 20 клиентам',
      status: 'Идёт сейчас',
      ctaText: 'Записаться',
      ctaAction: 'scroll-to-form'
    },
    {
      id: 'ballet-intensive-summer',
      active: true,
      hot: true,
      marquee: 'Балетный интенсив · старт 1 июня',
      tag: 'До 30 июня',
      title: 'Балетный интенсив — 30 000 ₽',
      emphasis: '30 000 ₽',
      description: '20 занятий по 2 часа в мини-группе 3–6 человек. Полный июньский курс.',
      counter: null,
      meta: 'Старт 1 июня',
      status: 'Идёт набор',
      ctaText: 'Подробнее',
      ctaAction: 'scroll-to-prices'
    }
  ];

  /* --------------------------------------------------------
     НАПРАВЛЕНИЯ (аккордеон в секции «Цены»)
     format.isTbd: true → цена ещё не утверждена, показываем «tbd»
     format.prefix: '~' | 'от' | 'до' — модификатор перед ценой
  -------------------------------------------------------- */
  var directions = [
    {
      id: 'pilates-equipment',
      num: '01',
      name: 'Пилатес на оборудовании',
      sub: 'реформер · кадиллак · бочки',
      rangeFrom: 1700,
      description: 'Работа на Legacy — точно настроенное сопротивление пружин, безопасно при любых ограничениях. Подходит беременным, людям после реабилитации, тем, кто хочет глубокую работу с осанкой и центром тела.',
      formats: [
        { name: 'Разовое групповое', price: 1700, isTbd: false },
        { name: 'Абонемент', price: null, isTbd: true },
        { name: 'Индивидуальное', price: 4500, isTbd: true, prefix: '~' },
        { name: 'Сплит на двоих', price: null, isTbd: true },
        { name: 'Мини-группа', price: null, isTbd: true }
      ]
    },
    {
      id: 'pilates-mat',
      num: '02',
      name: 'Пилатес на матах',
      sub: 'без оборудования · для группы',
      rangeFrom: 1000,
      description: 'Классический пилатес без реформера. Работа с собственным весом, малым оборудованием. Хорош для группового формата и тех, кто только знакомится с методом.',
      formats: [
        { name: 'Разовое групповое', price: 1000, isTbd: false },
        { name: 'Абонемент', price: null, isTbd: true },
        { name: 'Индивидуальное', price: null, isTbd: true },
        { name: 'Сплит на двоих', price: null, isTbd: true },
        { name: 'Мини-группа', price: null, isTbd: true }
      ]
    },
    {
      id: 'choreography',
      num: '03',
      name: 'Хореография',
      sub: 'дети · взрослые · классика и современная',
      rangeFrom: 1150,
      description: 'Балет, barre, современная хореография. Преподают действующие артисты Мариинского театра. Детям с 7 лет, взрослым в любом возрасте.',
      formats: [
        { name: 'Разовое групповое', price: 1150, isTbd: false },
        { name: 'Абонемент', price: null, isTbd: true },
        { name: 'Индивидуальное', price: null, isTbd: true },
        { name: 'Мини-группа', price: null, isTbd: true }
      ]
    },
    {
      id: 'yoga',
      num: '04',
      name: 'Йога',
      sub: 'хатха · кундалини · виброакустика',
      rangeFrom: 925,
      description: 'Хатха для подвижности тела. Кундалини и виброакустика — для работы с дыханием и состоянием. Ведёт Манприт Ади Каур.',
      formats: [
        { name: 'Разовое групповое', price: 925, isTbd: false },
        { name: 'Абонемент', price: null, isTbd: true },
        { name: 'Индивидуальное', price: null, isTbd: true }
      ]
    },
    {
      id: 'stretching',
      num: '05',
      name: 'Растяжка',
      sub: 'пассивная · с тренером · парная',
      rangeFrom: 925,
      description: 'Работа над гибкостью без перегрузки суставов. Как отдельная практика и как восстановительный блок после интенсивных тренировок.',
      formats: [
        { name: 'Разовое групповое', price: 925, isTbd: false },
        { name: 'Индивидуальное', price: 3000, isTbd: true, prefix: '~' },
        { name: 'Парная', price: null, isTbd: true },
        { name: 'Абонемент', price: null, isTbd: true }
      ]
    },
    {
      id: 'massage',
      num: '06',
      name: 'Массаж и восстановление',
      sub: 'спортивный · миофасциальный · остеопатия',
      rangeFrom: 4300,
      description: 'Отдельный кабинет восстановления. Работают приглашённые специалисты. Заходить можно отдельным сеансом или сразу после тренировки.',
      formats: [
        { name: 'Спортивный массаж, 60 мин', price: 4300, isTbd: false, prefix: 'от' },
        { name: 'Миофасциальный', price: null, isTbd: true },
        { name: 'Остеопатия', price: 7000, isTbd: false, prefix: 'до' }
      ]
    },
    {
      id: 'ballet-intensive',
      num: '07',
      name: 'Балетный интенсив',
      sub: 'июнь · 20 занятий · мини-группа',
      rangeFrom: 30000,
      fixed: true,
      description: 'Сезонный продукт. 1–30 июня, 5 дней в неделю, 20 занятий по 2 часа. Мини-группы 3–6 человек, с 7 лет.',
      formats: [
        { name: 'Полный курс', price: 30000, isTbd: false },
        { name: 'Пробное', price: 1000, isTbd: false }
      ]
    }
  ];

  /* --------------------------------------------------------
     КОМАНДА
     photoWebp/photoJpg — слот фото; если нет, ставим initials-плейсхолдер
  -------------------------------------------------------- */
  var team = [
    {
      id: 'olesya',
      name: 'Олеся Гапиенко',
      role: 'Балет · Пилатес · Barre',
      bio: 'Ведущая солистка Мариинского театра. Выпускница Академии Русского балета им. Вагановой (класс И. А. Трофимовой). Педагог у Комлевой, преподаватель Школы Долгушина при Консерватории.',
      photoWebp: '/public/images/team/olesya-stage/olesya-swan-solo-1.webp',
      photoJpg: '/public/images/team/olesya-stage/olesya-swan-solo-1.jpg'
    },
    {
      id: 'yuri-lapshin',
      name: 'Юрий Лапшин',
      role: 'Пилатес · Йога · ушу',
      bio: 'Чемпион мира по ушу. Работает на стыке восточных практик и пилатеса — точное движение, контроль дыхания, функциональный тренинг.',
      initials: 'ЮЛ'
    },
    {
      id: 'yuri-kalinin',
      name: 'Юрий Калинин',
      role: 'Классика · Балет',
      bio: 'Солист балета. Преподаёт классическую хореографию детям и взрослым. От подготовки в учебное заведение до поддержания формы.',
      initials: 'ЮК'
    },
    {
      id: 'manpreet',
      name: 'Манприт Ади Каур',
      role: 'Йога · Кундалини',
      bio: 'Хатха-йога, кундалини, виброакустика, пилатес на матах. Глубокая работа с дыханием и состоянием.',
      initials: 'МК'
    }
  ];

  var troupe = ['Акулинин', 'Штанева', 'Ушакова', 'Дубровин', 'И. Иванова', 'Азанов', 'В. Иванова'];

  /* --------------------------------------------------------
     FAQ
  -------------------------------------------------------- */
  var faq = [
    {
      q: 'Я никогда не была на пилатесе. С чего начать?',
      a: 'С пробного занятия. 55 минут с тренером: разбор осанки, особенностей и задач, потом полноценная тренировка. После — расскажем, какой формат и частота подойдут.'
    },
    {
      q: 'А если у меня травма или беременность?',
      a: 'Реформер изначально создавался для реабилитации. Сопротивление пружин настраивается под любое состояние. Уточните особенности при записи — тренер подготовит программу.'
    },
    {
      q: 'Что надеть на занятие?',
      a: 'Любую удобную спортивную одежду без замков и металлических элементов. Носки с прорезиненной подошвой обязательны — есть в продаже на ресепшене.'
    },
    {
      q: 'Можно ли заморозить абонемент?',
      a: 'Да, один раз на срок до 30 дней по личному заявлению. Действует на все типы абонементов.'
    },
    {
      q: 'Принимаете ли детей?',
      a: 'Да, на хореографию и балетный интенсив — с 7 лет. На пилатес-оборудование — с 14 лет, по согласованию с тренером.'
    },
    {
      q: 'Есть ли душевая?',
      a: 'Да, в студии есть раздевалка с душем, полотенца и средства для душа предоставляются.'
    }
  ];

  /* --------------------------------------------------------
     ОБОРУДОВАНИЕ (модалка в секции «Пространство»)
     image: null → рендерится плашка «СКОРО»
  -------------------------------------------------------- */
  var equipment = [
    {
      id: 'reformer',
      name: 'Реформер',
      count: 3,
      image: '/public/images/studio/studio-reformers-window.jpg',
      imageWebp: '/public/images/studio/studio-reformers-window.webp',
      description: 'Описание скоро.'
    },
    {
      id: 'cadillac',
      name: 'Кадиллак',
      count: 2,
      image: '/public/images/studio/studio-cadillac-window.jpg',
      imageWebp: '/public/images/studio/studio-cadillac-window.webp',
      description: 'Описание скоро.'
    },
    {
      id: 'ladder-barrel',
      name: 'Ladder Barrel',
      count: 1,
      image: '/public/images/studio/studio-barrel-legacy.jpg',
      imageWebp: '/public/images/studio/studio-barrel-legacy.webp',
      description: 'Описание скоро.'
    },
    {
      id: 'spine-corrector',
      name: 'Spine Corrector',
      count: 1,
      image: null,
      imageWebp: null,
      description: 'Описание скоро.'
    },
    {
      id: 'wunda-chair',
      name: 'Wunda Chair',
      count: 1,
      image: '/public/images/studio/studio-chair-wunda.jpg',
      imageWebp: '/public/images/studio/studio-chair-wunda.webp',
      description: 'Описание скоро.'
    },
    {
      id: 'high-chair',
      name: 'High Chair',
      count: 1,
      image: '/public/images/studio/studio-chair-wunda-side.jpg',
      imageWebp: '/public/images/studio/studio-chair-wunda-side.webp',
      description: 'Описание скоро.'
    },
    {
      id: 'box',
      name: 'Reformer Box',
      count: 1,
      image: null,
      imageWebp: null,
      description: 'Описание скоро.'
    }
  ];

  return {
    promos: promos,
    directions: directions,
    team: team,
    troupe: troupe,
    faq: faq,
    equipment: equipment,
    directOpenUrl: 'https://instagram.com/chapaeva17_studio'
  };
})();
