import type { Locale } from '@/lib/i18n/locales';

/** /compare copy in every locale (see content/pages/features.ts). The table's
 *  yes/no cells stay in the page; `rows` are their labels, in the same order. */

const en = {
  metaTitle: 'Compare social media schedulers',
  metaDesc:
    'How Sosial compares with all-in-one social suites, single-network schedulers and posting by hand: what each costs you and where each approach wins.',
  kicker: 'Compare',
  title: 'Where Sosial fits.',
  lede: 'Suites do a lot and charge for the lot. Single-network apps are light and stay in one lane. Posting by hand is free until it is 11pm. Here is the honest shape of each.',
  capability: 'Capability',
  headers: ['Sosial', 'Suites', 'Single-network apps', 'By hand'],
  rows: [
    'Ten networks in one composer',
    'Publishes with the app closed',
    'Live character limits before you schedule',
    'AI writer with linked sources',
    'Approvals and roles',
    'Free plan that stays free',
    'No per-channel paywall',
    'Works on iOS, Android and web',
  ],
  note: 'Categories, not a takedown: "suites" means the big all-in-one tools, and "single-network apps" means schedulers built around one platform. Features across that group change often, so check current plans before you buy anything, ours included.',
  fit: {
    kicker: 'Honest fit',
    title: 'Each approach wins somewhere.',
    lede: 'Pick the tool for the job you actually do every day, not the longest feature list.',
    items: [
      {
        title: 'All-in-one suites',
        body: 'Right if you need listening, ad buying and enterprise reporting. You pay for all of it, even the parts you never open.',
      },
      {
        title: 'Single-network apps',
        body: 'Great for one lane. The cost appears when one idea has to become posts for several networks: retyping, re-checking, remembering.',
      },
      { title: 'Posting by hand', body: 'Free and flexible until the week gets busy. Then the queue is the first thing to slip.' },
    ],
  },
  faq: [
    {
      q: 'Why not just use a big suite?',
      a: 'If you need listening, ads and enterprise reporting, a suite may serve you better. If your job is writing posts and getting them out on ten networks on time, the suite tax buys a lot of surface you never open.',
    },
    {
      q: 'Why not a free single-network app?',
      a: 'They are great for one lane. The cost shows up when one idea has to become ten posts: retyping, re-previewing, re-counting characters, and remembering which draft went where.',
    },
    {
      q: 'Why not post by hand?',
      a: 'You can. Hand posting works until the week gets busy, and then the queue is the first thing to slip. A calendar you fill once beats five apps you remember at midnight.',
    },
    {
      q: 'What does Sosial not do?',
      a: 'Social listening and ad buying. Those live in the suites. Sosial does compose, preview, schedule, approve and publish across your networks, with an AI writer, analytics and one inbox for comments and messages.',
    },
  ],
  ctaTitle: 'Writing and shipping posts is the whole job here.',
  ctaBody: 'Compose once, preview every network, schedule the week and let the queue publish it. Start on the free plan, no card needed.',
};

export type CompareCopy = typeof en;

const es: CompareCopy = {
  metaTitle: 'Compara programadores de redes sociales',
  metaDesc:
    'Cómo se compara Sosial con las suites todo en uno, los programadores de una sola red y publicar a mano: lo que te cuesta cada opción y dónde gana cada una.',
  kicker: 'Comparar',
  title: 'Dónde encaja Sosial.',
  lede: 'Las suites hacen mucho y cobran por todo. Las apps de una sola red son ligeras y se quedan en su carril. Publicar a mano es gratis hasta que son las 11 de la noche. Así es, con honestidad, cada opción.',
  capability: 'Capacidad',
  headers: ['Sosial', 'Suites', 'Apps de una red', 'A mano'],
  rows: [
    'Diez redes en un solo editor',
    'Publica con la app cerrada',
    'Límites de caracteres en vivo antes de programar',
    'Redactor con IA y fuentes enlazadas',
    'Aprobaciones y roles',
    'Plan gratuito que sigue siendo gratis',
    'Sin cobro por canal',
    'Funciona en iOS, Android y web',
  ],
  note: 'Categorías, no un ataque: «suites» son las grandes herramientas todo en uno y «apps de una red» son programadores creados en torno a una plataforma. Sus funciones cambian a menudo, así que revisa los planes actuales antes de comprar nada, incluido el nuestro.',
  fit: {
    kicker: 'Encaje honesto',
    title: 'Cada opción gana en algo.',
    lede: 'Elige la herramienta para el trabajo que haces cada día, no la lista de funciones más larga.',
    items: [
      { title: 'Suites todo en uno', body: 'Lo adecuado si necesitas escucha social, compra de anuncios e informes corporativos. Pagas por todo, incluso por lo que nunca abres.' },
      { title: 'Apps de una sola red', body: 'Geniales para un solo carril. El coste aparece cuando una idea tiene que convertirse en publicaciones para varias redes: reescribir, revisar, recordar.' },
      { title: 'Publicar a mano', body: 'Gratis y flexible hasta que la semana se complica. Entonces la cola es lo primero que se resiente.' },
    ],
  },
  faq: [
    { q: '¿Por qué no usar una gran suite?', a: 'Si necesitas escucha social, anuncios e informes corporativos, una suite puede servirte mejor. Si tu trabajo es escribir publicaciones y sacarlas a tiempo en diez redes, el sobrecoste de la suite paga mucho que nunca abrirás.' },
    { q: '¿Por qué no una app gratuita de una sola red?', a: 'Son geniales para un carril. El coste aparece cuando una idea tiene que convertirse en diez publicaciones: reescribir, volver a previsualizar, volver a contar caracteres y recordar qué borrador fue a dónde.' },
    { q: '¿Por qué no publicar a mano?', a: 'Puedes. Publicar a mano funciona hasta que la semana se complica, y entonces la cola es lo primero que se resiente. Un calendario que llenas una vez gana a cinco apps que recuerdas a medianoche.' },
    { q: '¿Qué no hace Sosial?', a: 'Escucha social y compra de anuncios. Eso está en las suites. Sosial redacta, previsualiza, programa, aprueba y publica en tus redes, con un redactor con IA, analíticas y una bandeja única para comentarios y mensajes.' },
  ],
  ctaTitle: 'Escribir y publicar es todo el trabajo aquí.',
  ctaBody: 'Redacta una vez, previsualiza cada red, programa la semana y deja que la cola publique. Empieza con el plan gratuito, sin tarjeta.',
};

const fr: CompareCopy = {
  metaTitle: 'Comparer les outils de planification des réseaux sociaux',
  metaDesc:
    'Sosial face aux suites tout-en-un, aux outils dédiés à un seul réseau et à la publication manuelle : ce que chaque option vous coûte et où chacune l’emporte.',
  kicker: 'Comparer',
  title: 'Où se situe Sosial.',
  lede: 'Les suites font beaucoup et facturent tout. Les applis mono-réseau sont légères et restent dans leur couloir. Publier à la main est gratuit jusqu’à 23 h. Voici, honnêtement, ce que vaut chacune.',
  capability: 'Fonction',
  headers: ['Sosial', 'Suites', 'Applis mono-réseau', 'À la main'],
  rows: [
    'Dix réseaux dans un seul éditeur',
    'Publie application fermée',
    'Limites de caractères en direct avant de planifier',
    'Rédacteur IA avec sources',
    'Validations et rôles',
    'Offre gratuite qui reste gratuite',
    'Pas de supplément par canal',
    'Sur iOS, Android et le web',
  ],
  note: 'Des catégories, pas un règlement de comptes : « suites » désigne les grands outils tout-en-un, et « applis mono-réseau » les outils construits autour d’une seule plateforme. Leurs fonctions changent souvent : vérifiez les offres actuelles avant d’acheter, la nôtre comprise.',
  fit: {
    kicker: 'En toute honnêteté',
    title: 'Chaque approche a ses points forts.',
    lede: 'Choisissez l’outil pour le travail que vous faites vraiment chaque jour, pas la plus longue liste de fonctions.',
    items: [
      { title: 'Suites tout-en-un', body: 'Le bon choix si vous avez besoin d’écoute sociale, d’achat publicitaire et de reporting d’entreprise. Vous payez tout, même ce que vous n’ouvrez jamais.' },
      { title: 'Applis mono-réseau', body: 'Parfaites pour un seul couloir. Le coût apparaît quand une idée doit devenir des publications pour plusieurs réseaux : ressaisir, revérifier, se souvenir.' },
      { title: 'Publier à la main', body: 'Gratuit et souple jusqu’à ce que la semaine s’emballe. Alors la file est la première à déraper.' },
    ],
  },
  faq: [
    { q: 'Pourquoi ne pas prendre une grande suite ?', a: 'Si vous avez besoin d’écoute, de publicité et de reporting d’entreprise, une suite vous conviendra peut-être mieux. Si votre métier est d’écrire des publications et de les diffuser à l’heure sur dix réseaux, le surcoût d’une suite paie beaucoup de fonctions que vous n’ouvrirez jamais.' },
    { q: 'Pourquoi pas une appli mono-réseau gratuite ?', a: 'Elles sont parfaites pour un seul couloir. Le coût apparaît quand une idée doit devenir dix publications : ressaisir, reprévisualiser, recompter les caractères et se souvenir de quel brouillon est allé où.' },
    { q: 'Pourquoi ne pas publier à la main ?', a: 'Vous pouvez. Cela marche jusqu’à ce que la semaine s’emballe, et la file est alors la première à déraper. Un calendrier rempli une fois vaut mieux que cinq applis auxquelles on pense à minuit.' },
    { q: 'Que ne fait pas Sosial ?', a: 'L’écoute sociale et l’achat publicitaire, qui relèvent des suites. Sosial rédige, prévisualise, planifie, fait valider et publie sur vos réseaux, avec un rédacteur IA, des statistiques et une boîte de réception unique pour les commentaires et messages.' },
  ],
  ctaTitle: 'Écrire et publier, c’est tout le travail ici.',
  ctaBody: 'Rédigez une fois, prévisualisez chaque réseau, planifiez la semaine et laissez la file publier. Commencez avec l’offre gratuite, sans carte bancaire.',
};

const de: CompareCopy = {
  metaTitle: 'Social-Media-Planer im Vergleich',
  metaDesc:
    'Wie Sosial im Vergleich zu All-in-one-Suiten, Planern für ein einzelnes Netzwerk und Posten von Hand abschneidet: was dich jeder Ansatz kostet und wo er punktet.',
  kicker: 'Vergleich',
  title: 'Wo Sosial hinpasst.',
  lede: 'Suiten können viel und berechnen alles. Apps für ein Netzwerk sind schlank und bleiben auf ihrer Spur. Von Hand posten kostet nichts, bis es 23 Uhr ist. Hier ist die ehrliche Form von jedem.',
  capability: 'Funktion',
  headers: ['Sosial', 'Suiten', 'Apps für ein Netzwerk', 'Von Hand'],
  rows: [
    'Zehn Netzwerke in einem Editor',
    'Veröffentlicht bei geschlossener App',
    'Live-Zeichenlimits vor dem Planen',
    'KI-Texter mit verlinkten Quellen',
    'Freigaben und Rollen',
    'Gratis-Plan, der gratis bleibt',
    'Keine Bezahlschranke pro Kanal',
    'Läuft auf iOS, Android und im Web',
  ],
  note: 'Kategorien, keine Abrechnung: „Suiten“ sind die großen All-in-one-Tools, „Apps für ein Netzwerk“ sind Planer rund um eine Plattform. Deren Funktionen ändern sich oft, also prüf die aktuellen Pläne vor dem Kauf, unsere eingeschlossen.',
  fit: {
    kicker: 'Ehrlich betrachtet',
    title: 'Jeder Ansatz gewinnt irgendwo.',
    lede: 'Wähl das Werkzeug für die Arbeit, die du wirklich jeden Tag machst, nicht die längste Funktionsliste.',
    items: [
      { title: 'All-in-one-Suiten', body: 'Richtig, wenn du Social Listening, Anzeigenkauf und Enterprise-Reporting brauchst. Du zahlst für alles, auch für das, was du nie öffnest.' },
      { title: 'Apps für ein Netzwerk', body: 'Stark auf einer Spur. Teuer wird es, wenn aus einer Idee Beiträge für mehrere Netzwerke werden müssen: abtippen, nachprüfen, daran denken.' },
      { title: 'Von Hand posten', body: 'Gratis und flexibel, bis die Woche voll wird. Dann gerät die Warteschlange als Erstes ins Rutschen.' },
    ],
  },
  faq: [
    { q: 'Warum nicht einfach eine große Suite?', a: 'Wenn du Listening, Anzeigen und Enterprise-Reporting brauchst, passt eine Suite vielleicht besser. Wenn deine Aufgabe ist, Beiträge zu schreiben und pünktlich auf zehn Netzwerken zu veröffentlichen, bezahlst du mit dem Suiten-Aufpreis viel Fläche, die du nie öffnest.' },
    { q: 'Warum nicht eine kostenlose App für ein Netzwerk?', a: 'Die sind stark auf einer Spur. Teuer wird es, wenn aus einer Idee zehn Beiträge werden: abtippen, neu voransehen, Zeichen neu zählen und merken, welcher Entwurf wohin ging.' },
    { q: 'Warum nicht von Hand posten?', a: 'Kannst du. Das klappt, bis die Woche voll wird, und dann rutscht die Warteschlange als Erstes. Ein Kalender, den du einmal füllst, schlägt fünf Apps, an die du um Mitternacht denkst.' },
    { q: 'Was macht Sosial nicht?', a: 'Social Listening und Anzeigenkauf. Das gehört in die Suiten. Sosial schreibt, zeigt Vorschauen, plant, gibt frei und veröffentlicht in deinen Netzwerken, mit KI-Texter, Analysen und einem Posteingang für Kommentare und Nachrichten.' },
  ],
  ctaTitle: 'Beiträge schreiben und veröffentlichen ist hier die ganze Aufgabe.',
  ctaBody: 'Einmal schreiben, jedes Netzwerk voransehen, die Woche planen und die Warteschlange veröffentlichen lassen. Starte mit dem Gratis-Plan, ohne Karte.',
};

const ja: CompareCopy = {
  metaTitle: 'SNS予約投稿ツールを比較',
  metaDesc:
    'Sosialと、オールインワンのスイート、単一ネットワーク向けツール、手動投稿との比較。それぞれのコストと、どこで優れているかを紹介します。',
  kicker: '比較',
  title: 'Sosialの立ち位置。',
  lede: 'スイートは多機能で、そのすべてに料金がかかります。単一ネットワーク向けアプリは軽快ですが、1つの用途にとどまります。手動投稿は夜11時までは無料です。それぞれの実際の姿を正直にまとめました。',
  capability: '機能',
  headers: ['Sosial', 'スイート', '単一ネットワーク向けアプリ', '手動'],
  rows: [
    '1つのエディターで10のネットワーク',
    'アプリを閉じていても公開',
    '予約前にリアルタイムで文字数を確認',
    '出典リンク付きのAIライター',
    '承認と権限',
    'ずっと無料の無料プラン',
    'チャネルごとの追加料金なし',
    'iOS、Android、ウェブで利用可能',
  ],
  note: '特定製品の批判ではなくカテゴリの比較です。「スイート」は大規模なオールインワンツール、「単一ネットワーク向けアプリ」は1つのプラットフォーム向けに作られた予約ツールを指します。機能は頻繁に変わるため、購入前には当社を含め最新のプランをご確認ください。',
  fit: {
    kicker: '正直な比較',
    title: 'どの方法にも強みがある。',
    lede: '機能の多さではなく、毎日実際に行う仕事に合ったツールを選びましょう。',
    items: [
      { title: 'オールインワンのスイート', body: 'ソーシャルリスニング、広告出稿、企業向けレポートが必要なら最適です。使わない部分も含めて、すべてに料金を払います。' },
      { title: '単一ネットワーク向けアプリ', body: '1つの用途には最適。1つのアイデアを複数のネットワーク向けの投稿にするとき、書き直し・再確認・覚えておく手間がかかります。' },
      { title: '手動で投稿', body: '忙しくなるまでは無料で柔軟。忙しくなると、真っ先に予定が崩れます。' },
    ],
  },
  faq: [
    { q: '大手のスイートを使えばいいのでは？', a: 'リスニング、広告、企業向けレポートが必要ならスイートのほうが合うかもしれません。投稿を書いて10のネットワークに時間どおりに届けるのが仕事なら、スイートの割高な料金は使わない機能に消えていきます。' },
    { q: '無料の単一ネットワーク向けアプリではだめですか？', a: '1つの用途には最適です。1つのアイデアを10の投稿にするとき、書き直し、プレビューのやり直し、文字数の数え直し、どの下書きをどこに出したかの記憶といった手間がかかります。' },
    { q: '手動で投稿すればいいのでは？', a: 'もちろん可能です。ただ、忙しくなると真っ先に予定が崩れます。一度埋めればよいカレンダーは、深夜に思い出す5つのアプリに勝ります。' },
    { q: 'Sosialにできないことは？', a: 'ソーシャルリスニングと広告出稿です。これらはスイートの領域です。Sosialは、作成、プレビュー、予約、承認、公開をすべてのネットワークで行い、AIライター、分析、コメントとメッセージの受信箱も備えています。' },
  ],
  ctaTitle: '投稿を書いて届けること、それがすべて。',
  ctaBody: '一度書いて、すべてのネットワークをプレビューし、1週間分を予約してキューに任せましょう。無料プランから、カード不要で始められます。',
};

const ko: CompareCopy = {
  metaTitle: '소셜 미디어 예약 도구 비교',
  metaDesc:
    'Sosial을 올인원 소셜 스위트, 단일 네트워크용 예약 도구, 직접 게시와 비교했습니다. 각 방식에 드는 비용과 각각이 유리한 경우를 확인하세요.',
  kicker: '비교',
  title: 'Sosial이 맞는 자리.',
  lede: '스위트는 많은 일을 하고 그 모두에 요금을 받습니다. 단일 네트워크 앱은 가볍지만 한 가지 길에만 머뭅니다. 직접 게시는 밤 11시가 되기 전까진 공짜죠. 각각의 실제 모습을 솔직하게 정리했습니다.',
  capability: '기능',
  headers: ['Sosial', '스위트', '단일 네트워크 앱', '직접 게시'],
  rows: [
    '작성기 하나로 10개 네트워크',
    '앱을 닫아도 게시',
    '예약 전 실시간 글자 수 확인',
    '출처 링크가 있는 AI 작성 도우미',
    '승인과 역할',
    '계속 무료인 무료 요금제',
    '채널별 추가 요금 없음',
    'iOS, Android, 웹에서 사용',
  ],
  note: '특정 제품을 깎아내리려는 것이 아니라 범주를 비교한 것입니다. "스위트"는 대형 올인원 도구, "단일 네트워크 앱"은 한 플랫폼을 중심으로 만든 예약 도구를 뜻합니다. 기능은 자주 바뀌니 구매 전에 저희를 포함해 최신 요금제를 확인하세요.',
  fit: {
    kicker: '솔직한 비교',
    title: '방식마다 이기는 곳이 있습니다.',
    lede: '가장 긴 기능 목록이 아니라 매일 실제로 하는 일에 맞는 도구를 고르세요.',
    items: [
      { title: '올인원 스위트', body: '소셜 리스닝, 광고 구매, 기업용 리포트가 필요하다면 적합합니다. 한 번도 열지 않는 기능까지 모두 비용을 냅니다.' },
      { title: '단일 네트워크 앱', body: '한 가지 길에는 훌륭합니다. 아이디어 하나를 여러 네트워크용 게시물로 만들 때 다시 쓰고, 다시 확인하고, 기억해야 하는 비용이 생깁니다.' },
      { title: '직접 게시', body: '바빠지기 전까지는 무료이고 유연합니다. 바빠지면 일정이 가장 먼저 무너집니다.' },
    ],
  },
  faq: [
    { q: '그냥 대형 스위트를 쓰면 안 되나요?', a: '리스닝, 광고, 기업용 리포트가 필요하다면 스위트가 더 맞을 수 있어요. 게시물을 써서 10개 네트워크에 제시간에 올리는 것이 일이라면, 스위트의 추가 비용은 한 번도 열지 않을 기능에 쓰입니다.' },
    { q: '무료 단일 네트워크 앱은요?', a: '한 가지 길에는 훌륭합니다. 아이디어 하나를 게시물 10개로 만들 때 다시 쓰고, 다시 미리 보고, 글자 수를 다시 세고, 어떤 초안이 어디로 갔는지 기억하는 비용이 생깁니다.' },
    { q: '직접 게시하면 안 되나요?', a: '할 수 있어요. 바빠지기 전까지는요. 바빠지면 일정이 가장 먼저 무너집니다. 한 번 채우는 캘린더가 자정에 떠올리는 앱 다섯 개보다 낫습니다.' },
    { q: 'Sosial이 하지 않는 일은?', a: '소셜 리스닝과 광고 구매입니다. 그건 스위트의 영역이에요. Sosial은 모든 네트워크에서 작성, 미리 보기, 예약, 승인, 게시를 하고, AI 작성 도우미, 분석, 댓글과 메시지를 위한 받은편지함을 제공합니다.' },
  ],
  ctaTitle: '게시물을 쓰고 내보내는 것, 그게 전부입니다.',
  ctaBody: '한 번 쓰고, 모든 네트워크를 미리 보고, 한 주를 예약한 뒤 대기열에 맡기세요. 카드 없이 무료 요금제로 시작하세요.',
};

const zh: CompareCopy = {
  metaTitle: '社交媒体排期工具对比',
  metaDesc: 'Sosial 与一体化社交套件、单一网络排期工具以及手动发帖的对比：每种方式的成本，以及各自擅长的场景。',
  kicker: '对比',
  title: 'Sosial 的定位。',
  lede: '套件功能多，收费也全包。单一网络应用轻巧，但只走一条路。手动发帖是免费的，直到深夜 11 点。下面如实呈现每种方式。',
  capability: '能力',
  headers: ['Sosial', '套件', '单一网络应用', '手动'],
  rows: [
    '一个编辑器覆盖十个网络',
    '关闭应用也能发布',
    '排期前实时检查字数限制',
    '带来源链接的 AI 写作助手',
    '审批与角色',
    '一直免费的免费计划',
    '不按渠道额外收费',
    '支持 iOS、Android 和网页',
  ],
  note: '这是类别对比，不是针对谁：“套件”指大型一体化工具，“单一网络应用”指围绕单个平台打造的排期工具。这些产品的功能经常变化，购买前请查看最新计划，包括我们的。',
  fit: {
    kicker: '如实对比',
    title: '每种方式都有用武之地。',
    lede: '根据你每天实际做的工作选工具，而不是看谁的功能清单最长。',
    items: [
      { title: '一体化套件', body: '如果你需要社交聆听、广告投放和企业报表，它很合适。你要为所有功能付费，包括从不打开的部分。' },
      { title: '单一网络应用', body: '适合单一用途。当一个想法要变成多个网络的帖子时，成本就来了：重写、重查、还得记住。' },
      { title: '手动发帖', body: '在一周忙起来之前，免费又灵活。忙起来后，排期最先出问题。' },
    ],
  },
  faq: [
    { q: '为什么不直接用大型套件？', a: '如果你需要聆听、广告和企业报表，套件可能更适合你。如果你的工作是写帖子并准时发到十个网络，套件的溢价买到的是大量你从不打开的功能。' },
    { q: '为什么不用免费的单一网络应用？', a: '它们很适合单一用途。当一个想法要变成十条帖子时，成本就出现了：重写、重新预览、重新数字数，还得记住哪份草稿发到了哪里。' },
    { q: '为什么不手动发帖？', a: '当然可以。在一周忙起来之前都行，忙起来后排期最先出问题。填一次就能用的日历，胜过半夜才想起来的五个应用。' },
    { q: 'Sosial 不做什么？', a: '社交聆听和广告投放，这些属于套件。Sosial 负责在你的各个网络上撰写、预览、排期、审批和发布，并提供 AI 写作助手、数据分析，以及统一管理评论和私信的收件箱。' },
  ],
  ctaTitle: '在这里，写帖子和发帖子就是全部工作。',
  ctaBody: '写一次，预览每个网络，排好整周，让队列发布。从免费计划开始，无需绑卡。',
};

export const compareCopy: Record<Locale, CompareCopy> = { en, es, fr, de, ja, ko, zh };
