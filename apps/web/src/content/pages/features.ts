import type { Locale } from '@/lib/i18n/locales';

/**
 * /features copy in every locale. English is the source; each translation is
 * typed against it, so a missing string fails the typecheck. Links and the
 * app preview screens stay in the page; only words live here.
 */

const en = {
  metaTitle: 'Social media management features',
  metaDesc:
    'Everything in Sosial: a calendar that publishes to every channel, a composer with per-channel limits, approvals, analytics and an AI writer.',
  eyebrow: 'Features',
  title: 'Plan it, write it, ship it everywhere.',
  lede: 'Sosial is a calendar, a composer and an AI writer that share one queue, so a post goes from idea to every network without copy and paste. Everything below is the real app.',
  seeChannels: 'See every channel',
  heroCaption: 'The Sosial calendar with a month of posts across six accounts.',
  blocks: [
    {
      eyebrow: 'Publish',
      title: 'One calendar, every channel.',
      body: 'Drop a post on the calendar and the queue ships it on time, app open or closed. Drag it to another day and every channel moves with it.',
      points: ['Day, week, month, year and list views', 'Per-channel publish times', 'Honest per-channel results'],
      caption: 'The dashboard week. Read more on the Publish page.',
    },
    {
      eyebrow: 'Create',
      title: 'Write once, preview everywhere.',
      body: 'One composer writes for every network you pick, with live counters against the strictest limit and media that fits each feed.',
      points: ['Pick channels, write once', 'Post now or schedule', 'Threads, templates and designs'],
      caption: 'Create post, with the AI writer beside it.',
    },
    {
      eyebrow: 'AI assistant',
      title: 'A writer that knows each network.',
      body: 'Draft captions and threads from a single idea in 100+ languages, in the tone and structure you choose. Nothing publishes without you.',
      points: ['Language first', 'Tone, style and structure', 'Single posts or threads'],
      caption: 'The AI writer card, as it appears in Create post.',
    },
  ],
  /** Publish, Create, AI assistant, Integrations, Made for everyone, Pricing. */
  links: [
    { title: 'Publish', body: 'Calendar, queue, limits and control.' },
    { title: 'Create', body: 'The composer, templates and media.' },
    { title: 'AI assistant', body: 'Research, languages, styles and rewrites.' },
    { title: 'Integrations', body: 'Every network Sosial publishes to, and what each one rewards.' },
    { title: 'Made for everyone', body: 'Solo creators, small teams and agencies on the same calendar.' },
    { title: 'Pricing', body: 'A free plan with no end date, and paid plans you can read up front.' },
  ],
};

export type FeaturesCopy = typeof en;

const es: FeaturesCopy = {
  metaTitle: 'Funciones de gestión de redes sociales',
  metaDesc:
    'Todo lo que hace Sosial: un calendario que publica en cada canal, un editor con los límites de cada red, aprobaciones, analíticas y un redactor con IA.',
  eyebrow: 'Funciones',
  title: 'Planifícalo, escríbelo, publícalo en todas partes.',
  lede: 'Sosial es un calendario, un editor y un redactor con IA que comparten una sola cola, así que una publicación pasa de la idea a cada red sin copiar y pegar. Todo lo que ves abajo es la app real.',
  seeChannels: 'Ver todos los canales',
  heroCaption: 'El calendario de Sosial con un mes de publicaciones en seis cuentas.',
  blocks: [
    {
      eyebrow: 'Publicar',
      title: 'Un calendario, todos los canales.',
      body: 'Coloca una publicación en el calendario y la cola la publica a tiempo, con la app abierta o cerrada. Arrástrala a otro día y todos los canales se mueven con ella.',
      points: ['Vistas de día, semana, mes, año y lista', 'Hora de publicación por canal', 'Resultados claros por canal'],
      caption: 'La semana en el panel. Más detalles en la página Publicar.',
    },
    {
      eyebrow: 'Crear',
      title: 'Escribe una vez, previsualiza en todas partes.',
      body: 'Un solo editor escribe para cada red que elijas, con contadores en vivo frente al límite más estricto y medios que encajan en cada feed.',
      points: ['Elige canales, escribe una vez', 'Publica ya o programa', 'Hilos, plantillas y diseños'],
      caption: 'Crear publicación, con el redactor con IA al lado.',
    },
    {
      eyebrow: 'Asistente de IA',
      title: 'Un redactor que conoce cada red.',
      body: 'Redacta textos e hilos a partir de una sola idea en más de 100 idiomas, con el tono y la estructura que elijas. Nada se publica sin ti.',
      points: ['Primero el idioma', 'Tono, estilo y estructura', 'Publicaciones sueltas o hilos'],
      caption: 'La tarjeta del redactor con IA, tal como aparece en Crear publicación.',
    },
  ],
  links: [
    { title: 'Publicar', body: 'Calendario, cola, límites y control.' },
    { title: 'Crear', body: 'El editor, las plantillas y los medios.' },
    { title: 'Asistente de IA', body: 'Investigación, idiomas, estilos y reescrituras.' },
    { title: 'Integraciones', body: 'Cada red en la que publica Sosial y lo que premia cada una.' },
    { title: 'Hecho para todos', body: 'Creadores, equipos pequeños y agencias en el mismo calendario.' },
    { title: 'Precios', body: 'Un plan gratuito sin fecha de fin y planes de pago claros desde el principio.' },
  ],
};

const fr: FeaturesCopy = {
  metaTitle: 'Fonctionnalités de gestion des réseaux sociaux',
  metaDesc:
    'Tout Sosial : un calendrier qui publie sur chaque canal, un éditeur qui respecte les limites de chaque réseau, des validations, des statistiques et un rédacteur IA.',
  eyebrow: 'Fonctionnalités',
  title: 'Planifiez, écrivez, publiez partout.',
  lede: 'Sosial réunit un calendrier, un éditeur et un rédacteur IA autour d’une même file, pour qu’une publication passe de l’idée à chaque réseau sans copier-coller. Tout ce qui suit est la vraie application.',
  seeChannels: 'Voir tous les canaux',
  heroCaption: 'Le calendrier Sosial avec un mois de publications sur six comptes.',
  blocks: [
    {
      eyebrow: 'Publier',
      title: 'Un calendrier, tous les canaux.',
      body: 'Déposez une publication dans le calendrier et la file la publie à l’heure, application ouverte ou fermée. Déplacez-la à un autre jour et tous les canaux suivent.',
      points: ['Vues jour, semaine, mois, année et liste', 'Heure de publication par canal', 'Résultats clairs par canal'],
      caption: 'La semaine du tableau de bord. Plus de détails sur la page Publier.',
    },
    {
      eyebrow: 'Créer',
      title: 'Écrivez une fois, prévisualisez partout.',
      body: 'Un seul éditeur écrit pour chaque réseau choisi, avec des compteurs en direct sur la limite la plus stricte et des médias adaptés à chaque fil.',
      points: ['Choisissez les canaux, écrivez une fois', 'Publiez maintenant ou planifiez', 'Threads, modèles et visuels'],
      caption: 'Créer une publication, avec le rédacteur IA à côté.',
    },
    {
      eyebrow: 'Assistant IA',
      title: 'Un rédacteur qui connaît chaque réseau.',
      body: 'Rédigez légendes et threads à partir d’une seule idée dans plus de 100 langues, avec le ton et la structure de votre choix. Rien n’est publié sans vous.',
      points: ['La langue d’abord', 'Ton, style et structure', 'Publications simples ou threads'],
      caption: 'La carte du rédacteur IA, telle qu’elle apparaît dans Créer une publication.',
    },
  ],
  links: [
    { title: 'Publier', body: 'Calendrier, file, limites et contrôle.' },
    { title: 'Créer', body: 'L’éditeur, les modèles et les médias.' },
    { title: 'Assistant IA', body: 'Recherche, langues, styles et réécritures.' },
    { title: 'Intégrations', body: 'Chaque réseau sur lequel Sosial publie, et ce que chacun valorise.' },
    { title: 'Conçu pour tous', body: 'Créateurs solo, petites équipes et agences sur le même calendrier.' },
    { title: 'Tarifs', body: 'Une offre gratuite sans date de fin, et des offres payantes lisibles d’avance.' },
  ],
};

const de: FeaturesCopy = {
  metaTitle: 'Funktionen für Social-Media-Management',
  metaDesc:
    'Alles in Sosial: ein Kalender, der auf jedem Kanal veröffentlicht, ein Editor mit den Limits jedes Kanals, Freigaben, Analysen und ein KI-Texter.',
  eyebrow: 'Funktionen',
  title: 'Planen, schreiben, überall veröffentlichen.',
  lede: 'Sosial ist ein Kalender, ein Editor und ein KI-Texter mit einer gemeinsamen Warteschlange. So kommt ein Beitrag ohne Kopieren und Einfügen von der Idee in jedes Netzwerk. Alles unten ist die echte App.',
  seeChannels: 'Alle Kanäle ansehen',
  heroCaption: 'Der Sosial-Kalender mit einem Monat Beiträgen über sechs Konten.',
  blocks: [
    {
      eyebrow: 'Veröffentlichen',
      title: 'Ein Kalender, jeder Kanal.',
      body: 'Leg einen Beitrag in den Kalender und die Warteschlange veröffentlicht ihn pünktlich, ob die App offen ist oder nicht. Zieh ihn auf einen anderen Tag und alle Kanäle ziehen mit.',
      points: ['Tages-, Wochen-, Monats-, Jahres- und Listenansicht', 'Veröffentlichungszeit pro Kanal', 'Ehrliche Ergebnisse pro Kanal'],
      caption: 'Die Woche im Dashboard. Mehr dazu auf der Seite Veröffentlichen.',
    },
    {
      eyebrow: 'Erstellen',
      title: 'Einmal schreiben, überall voransehen.',
      body: 'Ein Editor schreibt für jedes gewählte Netzwerk, mit Live-Zählern gegen das strengste Limit und Medien, die in jeden Feed passen.',
      points: ['Kanäle wählen, einmal schreiben', 'Sofort posten oder planen', 'Threads, Vorlagen und Designs'],
      caption: 'Beitrag erstellen, mit dem KI-Texter daneben.',
    },
    {
      eyebrow: 'KI-Assistent',
      title: 'Ein Texter, der jedes Netzwerk kennt.',
      body: 'Entwirf Texte und Threads aus einer einzigen Idee in über 100 Sprachen, im Ton und Aufbau deiner Wahl. Ohne dich wird nichts veröffentlicht.',
      points: ['Zuerst die Sprache', 'Ton, Stil und Aufbau', 'Einzelne Beiträge oder Threads'],
      caption: 'Die KI-Texter-Karte, wie sie in Beitrag erstellen erscheint.',
    },
  ],
  links: [
    { title: 'Veröffentlichen', body: 'Kalender, Warteschlange, Limits und Kontrolle.' },
    { title: 'Erstellen', body: 'Der Editor, Vorlagen und Medien.' },
    { title: 'KI-Assistent', body: 'Recherche, Sprachen, Stile und Umformulierungen.' },
    { title: 'Integrationen', body: 'Jedes Netzwerk, auf dem Sosial veröffentlicht, und was dort gut ankommt.' },
    { title: 'Für alle gemacht', body: 'Solo-Creator, kleine Teams und Agenturen im selben Kalender.' },
    { title: 'Preise', body: 'Ein Gratis-Plan ohne Ablaufdatum und bezahlte Pläne, die du vorher nachlesen kannst.' },
  ],
};

const ja: FeaturesCopy = {
  metaTitle: 'SNS運用管理の機能',
  metaDesc:
    'Sosialのすべて：すべてのチャネルに投稿できるカレンダー、チャネルごとの文字数制限に対応したエディター、承認フロー、分析、AIライター。',
  eyebrow: '機能',
  title: '計画して、書いて、どこへでも届ける。',
  lede: 'Sosialは、カレンダー・エディター・AIライターが1つのキューを共有するツールです。コピー＆ペーストなしで、アイデアからすべてのネットワークへの投稿まで進められます。以下はすべて実際のアプリの画面です。',
  seeChannels: '対応チャネルを見る',
  heroCaption: '6つのアカウントにまたがる1か月分の投稿が並ぶSosialのカレンダー。',
  blocks: [
    {
      eyebrow: '投稿',
      title: '1つのカレンダーで、すべてのチャネルへ。',
      body: 'カレンダーに投稿を置けば、アプリを閉じていてもキューが時間どおりに公開します。別の日にドラッグすれば、すべてのチャネルの予定も一緒に移動します。',
      points: ['日・週・月・年・リスト表示', 'チャネルごとの公開時刻', 'チャネルごとの正確な結果'],
      caption: 'ダッシュボードの週表示。詳しくは「投稿」ページで。',
    },
    {
      eyebrow: '作成',
      title: '一度書けば、すべてをプレビュー。',
      body: '1つのエディターで選んだすべてのネットワーク向けに書けます。最も厳しい文字数制限に対してリアルタイムでカウントし、各フィードに合うメディアを用意します。',
      points: ['チャネルを選んで一度だけ書く', '今すぐ投稿または予約', 'スレッド、テンプレート、デザイン'],
      caption: '投稿作成画面。横にAIライターがあります。',
    },
    {
      eyebrow: 'AIアシスタント',
      title: '各ネットワークを理解したライター。',
      body: '1つのアイデアから、100以上の言語でキャプションやスレッドを下書きします。トーンや構成も選べます。あなたの確認なしに公開されることはありません。',
      points: ['まず言語を選ぶ', 'トーン、スタイル、構成', '単発投稿またはスレッド'],
      caption: '投稿作成画面に表示されるAIライターのカード。',
    },
  ],
  links: [
    { title: '投稿', body: 'カレンダー、キュー、制限、コントロール。' },
    { title: '作成', body: 'エディター、テンプレート、メディア。' },
    { title: 'AIアシスタント', body: 'リサーチ、言語、スタイル、リライト。' },
    { title: '連携', body: 'Sosialが投稿できるすべてのネットワークと、それぞれで評価される投稿。' },
    { title: 'すべての人のために', body: '個人クリエイターも小さなチームも代理店も、同じカレンダーで。' },
    { title: '料金', body: '期限のない無料プランと、事前に確認できる有料プラン。' },
  ],
};

const ko: FeaturesCopy = {
  metaTitle: '소셜 미디어 관리 기능',
  metaDesc:
    'Sosial의 모든 것: 모든 채널에 게시하는 캘린더, 채널별 글자 수 제한을 지키는 작성기, 승인, 분석, AI 작성 도우미.',
  eyebrow: '기능',
  title: '계획하고, 쓰고, 어디에나 게시하세요.',
  lede: 'Sosial은 캘린더, 작성기, AI 작성 도우미가 하나의 대기열을 공유합니다. 복사해 붙여넣지 않아도 아이디어가 모든 네트워크의 게시물이 됩니다. 아래는 모두 실제 앱 화면이에요.',
  seeChannels: '모든 채널 보기',
  heroCaption: '여섯 개 계정에 걸친 한 달 치 게시물이 담긴 Sosial 캘린더.',
  blocks: [
    {
      eyebrow: '게시',
      title: '캘린더 하나로 모든 채널을.',
      body: '캘린더에 게시물을 올려두면 앱이 열려 있든 닫혀 있든 대기열이 제시간에 게시합니다. 다른 날로 끌어 놓으면 모든 채널 일정이 함께 옮겨집니다.',
      points: ['일·주·월·연·목록 보기', '채널별 게시 시간', '채널별 정확한 결과'],
      caption: '대시보드의 주간 보기. 자세한 내용은 게시 페이지에서 확인하세요.',
    },
    {
      eyebrow: '만들기',
      title: '한 번 쓰고, 어디서나 미리 보기.',
      body: '작성기 하나로 고른 모든 네트워크용 글을 씁니다. 가장 엄격한 제한에 맞춰 글자 수를 실시간으로 세고, 각 피드에 맞는 미디어를 준비합니다.',
      points: ['채널을 고르고 한 번만 쓰기', '지금 게시 또는 예약', '스레드, 템플릿, 디자인'],
      caption: '게시물 만들기 화면과 옆의 AI 작성 도우미.',
    },
    {
      eyebrow: 'AI 어시스턴트',
      title: '네트워크마다 다르게 쓰는 작가.',
      body: '아이디어 하나로 100개 이상의 언어로 캡션과 스레드 초안을 만듭니다. 톤과 구성도 원하는 대로 고르세요. 승인 없이는 아무것도 게시되지 않습니다.',
      points: ['언어부터 선택', '톤, 스타일, 구성', '단일 게시물 또는 스레드'],
      caption: '게시물 만들기 화면에 표시되는 AI 작성 도우미 카드.',
    },
  ],
  links: [
    { title: '게시', body: '캘린더, 대기열, 제한, 관리.' },
    { title: '만들기', body: '작성기, 템플릿, 미디어.' },
    { title: 'AI 어시스턴트', body: '리서치, 언어, 스타일, 다시 쓰기.' },
    { title: '연동', body: 'Sosial이 게시하는 모든 네트워크와 각 네트워크에서 통하는 콘텐츠.' },
    { title: '모두를 위해', body: '1인 크리에이터, 작은 팀, 에이전시가 같은 캘린더에서.' },
    { title: '요금', body: '기한 없는 무료 요금제와 미리 확인할 수 있는 유료 요금제.' },
  ],
};

const zh: FeaturesCopy = {
  metaTitle: '社交媒体管理功能',
  metaDesc: 'Sosial 的全部功能：发布到每个渠道的日历、遵守各渠道字数限制的编辑器、审批、数据分析和 AI 写作助手。',
  eyebrow: '功能',
  title: '规划、撰写、处处发布。',
  lede: 'Sosial 把日历、编辑器和 AI 写作助手放进同一个队列，一条内容从想法到发往每个网络，无需复制粘贴。下面展示的都是真实的应用。',
  seeChannels: '查看所有渠道',
  heroCaption: 'Sosial 日历：六个账号一个月的帖子。',
  blocks: [
    {
      eyebrow: '发布',
      title: '一个日历，覆盖所有渠道。',
      body: '把帖子放进日历，无论应用是否打开，队列都会准时发布。拖到另一天，所有渠道一起跟着移动。',
      points: ['日、周、月、年和列表视图', '按渠道设置发布时间', '每个渠道的真实结果'],
      caption: '仪表盘中的一周。详见“发布”页面。',
    },
    {
      eyebrow: '创作',
      title: '写一次，处处预览。',
      body: '一个编辑器为你选择的每个网络撰写内容，实时按最严格的字数限制计数，并为每个信息流准备合适的媒体。',
      points: ['选择渠道，只写一次', '立即发布或排期', '串文、模板和设计'],
      caption: '创建帖子页面，旁边就是 AI 写作助手。',
    },
    {
      eyebrow: 'AI 助手',
      title: '了解每个网络的写作助手。',
      body: '用一个想法，以 100 多种语言起草文案和串文，语气和结构由你决定。未经你确认，不会发布任何内容。',
      points: ['先选语言', '语气、风格和结构', '单条帖子或串文'],
      caption: '创建帖子页面中的 AI 写作助手卡片。',
    },
  ],
  links: [
    { title: '发布', body: '日历、队列、限制与掌控。' },
    { title: '创作', body: '编辑器、模板和媒体。' },
    { title: 'AI 助手', body: '调研、语言、风格和改写。' },
    { title: '集成', body: 'Sosial 可发布的每个网络，以及各自偏好的内容。' },
    { title: '为每个人打造', body: '独立创作者、小团队和代理机构共用同一个日历。' },
    { title: '价格', body: '没有期限的免费计划，以及提前就能看清的付费计划。' },
  ],
};

export const featuresCopy: Record<Locale, FeaturesCopy> = { en, es, fr, de, ja, ko, zh };
