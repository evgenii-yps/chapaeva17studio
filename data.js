/* Чапаева 17 — контент-конфиг.
   Правится без изменения разметки: акции, направления, команда, FAQ.
   Когда появятся точные цены — меняем isTbd: true → false и проставляем price. */
window.CH17_DATA = (function () {
  'use strict';

  /* --------------------------------------------------------
     АКЦИИ
     Поля — для карточки в блоке «Не упусти».
     Карточка рендерится только если active && есть title.
     ctaAction: scroll-to-prices | scroll-to-form | open-direct
  -------------------------------------------------------- */
  var promos = [
    {
      id: 'spring20',
      active: true,
      hot: false,
      tag: 'Знакомство',
      title: '−20% на первый абонемент',
      emphasis: '−20%',
      description: 'Скидка 20% при покупке первого абонемента — на любое направление студии.',
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
      tag: 'До конца лета',
      title: 'Балетный интенсив — Уточнить индивидуально',
      emphasis: 'Уточнить индивидуально',
      description: 'Полный курс: 20 занятий по 2 часа в мини-группе 3–6 человек.',
      counter: null,
      meta: 'Старт 1 июня',
      status: 'Идёт сейчас',
      ctaText: 'Подробнее',
      ctaAction: 'scroll-to-prices'
    }
  ];

  /* --------------------------------------------------------
     НАПРАВЛЕНИЯ (аккордеон в секции «Цены»)
     longDescription — многоабзацный текст (абзацы через \n)
     image — фото для раскрытой строки; null → плейсхолдер
     prices[] — { format, price }; price: 'tbd' пока не утверждена
  -------------------------------------------------------- */
  var STUB_LONG = 'Рыба.\n\nРазвёрнутое описание направления — заполним позже.\n\nЕщё один абзац для проверки многоабзацной верстки.';
  var STUB_PRICES = [
    { format: 'Разовое', price: 'tbd' },
    { format: 'Абонемент', price: 'tbd' },
    { format: 'Индивидуальное', price: 'tbd' },
    { format: 'Сплит на двоих', price: 'tbd' },
    { format: 'Мини-группа', price: 'tbd' }
  ];

  var directions = [
    {
      id: 'pilates-equipment',
      num: '01',
      name: 'Пилатес на оборудовании',
      rangeFrom: 1700,
      longDescription: STUB_LONG,
      image: null,
      priceNote: { value: 'Индивидуально' },
      prices: null
    },
    {
      id: 'pilates-mat',
      num: '02',
      name: 'Пилатес на матах',
      rangeFrom: 1000,
      longDescription: STUB_LONG,
      image: null,
      priceNote: { value: 'Индивидуально' },
      prices: null
    },
    {
      id: 'choreography',
      num: '03',
      name: 'Хореография',
      rangeFrom: 1150,
      longDescription: STUB_LONG,
      image: null,
      priceNote: { value: 'Индивидуально' },
      prices: null
    },
    {
      id: 'yoga',
      num: '04',
      name: 'Йога',
      rangeFrom: 925,
      longDescription: STUB_LONG,
      image: null,
      priceNote: { value: 'Индивидуально' },
      prices: null
    },
    {
      id: 'stretching',
      num: '05',
      name: 'Растяжка',
      rangeFrom: 925,
      longDescription: STUB_LONG,
      image: null,
      priceNote: { value: 'Индивидуально' },
      prices: null
    },
    {
      id: 'massage',
      num: '06',
      name: 'Массаж и восстановление',
      rangeFrom: 4300,
      longDescription: STUB_LONG,
      image: null,
      priceNote: { value: 'Индивидуально' },
      prices: null
    },
    {
      id: 'ballet-intensive',
      num: '07',
      name: 'Балетный интенсив',
      rangeFrom: 30000,
      longDescription: 'Лето с «Ч17» — не просто каникулы, а живая работа с телом. Пилатес и хореография в тандеме творят чудеса: мы выходим за пределы привычных движений и учимся видеть возможности своего тела в пространстве.\n\nНад чем работаем: замечать детали, выстраивать баланс, убирать зажимы, улучшать физическую форму.\n\nЗаниматься с вами будут люди, для которых движение — профессия: артисты балета с педагогическим образованием, спортивные тренеры, тренеры по пилатесу. В уютном пространстве на Петроградке, в атмосфере заботы и спокойствия, занимаемся тонкой настройкой организма — ради хорошего самочувствия и качества жизни.',
      image: '/public/images/directions/ballet-intensive.jpg',
      imageWebp: null,
      priceNote: { value: 'Индивидуально' },
      prices: null
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
      role: 'Балет · Пилатес · Barre · Растяжка',
      bio: [
        'Действующая солистка балета и педагог школы классического балета им. Н. А. Долгушина.',
        'Высшее педагогическое образование — Академия Русского балета им. А. Я. Вагановой (класс профессора И. А. Трофимовой) и Санкт-Петербургская консерватория им. Римского-Корсакова (педагог-репетитор, класс народной артистки СССР Г. Т. Комлевой). В настоящее время — аспирант Академии Русского балета им. А. Я. Вагановой.',
        'Творческий стаж в государственных театрах Санкт-Петербурга — 21 год. Солистка балета Большого театра им. А. Навои в Ташкенте, артистка балета Театра балета им. Л. Якобсона (2007–2008), ведущая солистка Театра оперы и балета Санкт-Петербургской консерватории (2008–2015); с 2017 года — приглашённая солистка арт-центра «Сен-Мишель».',
        'Прошла обучение программе преподавания классического пилатеса в школе FW Pilates. В студии ведёт балет, пилатес, barre и растяжку.'
      ],
      photoWebp: '/public/images/team/olesya-stage/olesya-swan-solo-1.webp',
      photoJpg: '/public/images/team/olesya-stage/olesya-swan-solo-1.jpg'
    },
    {
      id: 'yuri-lapshin',
      name: 'Юрий Лапшин',
      role: 'Пилатес · Йога · ушу',
      bio: [
        'Тренер и преподаватель. Трёхкратный чемпион мира по ушу.',
        'Работает на стыке восточных практик и пилатеса: точное движение, контроль дыхания, осознанная работа тела. За плечами — годы спорта высших достижений, где цена ошибки в технике видна сразу, поэтому в зале он смотрит не на число повторений, а на то, как именно вы двигаетесь.',
        'Его пилатес и функциональный тренинг — про управляемое движение, а не нагрузку ради нагрузки: ровное дыхание, устойчивый центр, тело, которое слушается. Одинаково работает и для новичка, и для того, кто возвращает форму без надрыва.',
        'В студии ведёт пилатес, йогу и функциональный тренинг.'
      ],
      initials: 'ЮЛ',
      photoWebp: '/public/images/team/yuri-lapshin.webp',
      photoJpg: '/public/images/team/yuri-lapshin.jpg'
    },
    {
      id: 'maria-gustinovich',
      name: 'Мария Густинович',
      role: 'Йога · Пилатес · Звукотерапия',
      bookingDirection: 'Пилатес на оборудовании',
      bio: [
        'Преподаватель йоги и мастер восстановительных практик.',
        'Ведёт йогатерапию и кундалини-йогу, преподаёт пилатес на реформере — точная работа с телом, где движение и дыхание идут вместе. Её занятия не про нагрузку ради нагрузки, а про то, чтобы тело услышало само себя.',
        'Мастер звукотерапии: работает с поющими чашами и звуком как инструментом, который снимает напряжение и возвращает телу тишину. Также практикует Рэйки (III ступень), Access Bars и васту, проводит индивидуальные трансформационные разборы и консультации.',
        'В студии Мария ведёт йогу, пилатес на оборудовании и восстановительные сессии — для тех, кто приходит не только за формой, но и за состоянием.'
      ],
      photoWebp: '/public/images/team/maria-gustinovich.webp',
      photoJpg: '/public/images/team/maria-gustinovich.jpg'
    }
  ];

  var troupe = [];

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

  /* --------------------------------------------------------
     ФОТОАЛЬБОМ СТУДИИ (модалка «Студия» в секции «Пространство»)
  -------------------------------------------------------- */
  var studioPhotos = [
    { id: 'lounge-armchair',  image: '/public/images/studio/studio-lounge-armchair.jpg',  imageWebp: '/public/images/studio/studio-lounge-armchair.webp',  alt: 'Зона отдыха с креслом' },
    { id: 'lounge-shelf',     image: '/public/images/studio/studio-lounge-shelf.jpg',     imageWebp: '/public/images/studio/studio-lounge-shelf.webp',     alt: 'Шкаф и сертификат Legacy' },
    { id: 'yoga-zone',        image: '/public/images/studio/studio-yoga-zone.jpg',        imageWebp: '/public/images/studio/studio-yoga-zone.webp',        alt: 'Йога-зона с растениями и чашами' },
    { id: 'reformers-map',    image: '/public/images/studio/studio-reformers-map.jpg',    imageWebp: '/public/images/studio/studio-reformers-map.webp',    alt: 'Реформеры на фоне карты мира' },
    { id: 'wall-stations',    image: '/public/images/studio/studio-wall-stations.jpg',    imageWebp: '/public/images/studio/studio-wall-stations.webp',    alt: 'Стена с пружинными станциями' },
    { id: 'tower-station',    image: '/public/images/studio/studio-tower-station.jpg',    imageWebp: '/public/images/studio/studio-tower-station.webp',    alt: 'Башня с пружинной стенкой' },
    { id: 'cadillac-front',   image: '/public/images/studio/studio-cadillac-front.jpg',   imageWebp: '/public/images/studio/studio-cadillac-front.webp',   alt: 'Кадиллак фронтально' },
    { id: 'cadillac-springs', image: '/public/images/studio/studio-cadillac-springs.jpg', imageWebp: '/public/images/studio/studio-cadillac-springs.webp', alt: 'Пружины и аксессуары кадиллака' }
  ];

  return {
    promos: promos,
    directions: directions,
    team: team,
    troupe: troupe,
    faq: faq,
    equipment: equipment,
    studioPhotos: studioPhotos,
    directOpenUrl: 'https://instagram.com/chapaeva17_studio'
  };
})();
