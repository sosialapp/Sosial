import type { Locale } from '@/lib/i18n/locales';

/** /made-for-everyone copy in every locale (see content/pages/features.ts). */

const en = {
  metaTitle: 'Affordable social media scheduler in 100+ languages',
  metaDesc:
    'A free plan that stays free, 100+ languages, real accessibility, and apps on iOS, Android and the web. Social media scheduling built for everyone.',
  kicker: 'Made for everyone',
  title: 'Publishing should not be a privilege.',
  lede: 'The tools behind daily posting got expensive, English-first and desktop-only. Sosial is the opposite: a free plan that stays free, a hundred languages, and the same app in your pocket as on your desk.',
  stats: [
    { value: '100+', label: 'Languages the AI writer drafts in natively.' },
    { value: '3', label: 'Ways in: iOS, Android and the web, on one workspace.' },
    { value: 'Free', label: 'Plan with no card, no trial clock and no end date.' },
    { value: '0', label: 'Devices that need to stay on for posts to go out.' },
  ],
  who: {
    kicker: 'Who it is for',
    title: 'One workspace, very different jobs.',
    lede: 'Solo, small team or agency: the same composer, calendar and queue, with roles where you need them.',
    /** Linked to Create, AI assistant and Publish, in that order. */
    items: [
      {
        title: 'Creators and founders',
        body: 'One person, many channels, no team. Write in the morning, let the queue ship through the day, keep the evening for actual work.',
        linkLabel: 'See the composer',
      },
      {
        title: 'Small teams',
        body: 'A marketer, a writer and a founder who wants to approve things. Members draft, admins publish, owners hold accounts and billing.',
        linkLabel: 'Meet the AI writer',
      },
      {
        title: 'Agencies and freelancers',
        body: 'Many clients, clear edges. Keep each workspace separate, schedule across every network, and report with real analytics.',
        linkLabel: 'See publishing',
      },
    ],
  },
  access: {
    kicker: 'Built in, not bolted on',
    title: 'Access is part of the product.',
    lede: 'Language, devices and accessibility are defaults, not a premium tier.',
    items: [
      {
        title: 'Your language, first',
        body: 'The AI writer picks from 100+ languages before it drafts, so the output is native rather than translated. English, Melayu, Tamil and beyond, with previews in your script.',
      },
      {
        title: 'Phone, tablet, desk, equal',
        body: 'iOS, Android and the web run the same workspace and queue. Approve a post on the train; the worker still ships it on time with the laptop shut.',
      },
      {
        title: 'Built to be used',
        body: 'Contrast checked in light and dark, keyboard paths through every flow, and alt text prompts where networks expect them.',
      },
      {
        title: 'Free means free',
        body: 'Three channels and a month of scheduled posts cost nothing. When you outgrow it, the paid prices are on a page you can read before signing up.',
      },
    ],
  },
  basics: {
    kicker: 'Every plan',
    title: 'The basics are never behind a paywall.',
    items: ['Calendar and queue', 'Per-channel previews and limits', 'iOS, Android and web', 'Your data, exportable on request'],
  },
  faq: [
    {
      q: 'Is the free plan a trial?',
      a: 'No. It has limits (3 channels, 10 scheduled posts per channel, 20 AI credits a month) and no end date. Credits reset on the 1st whether you upgrade or not.',
    },
    {
      q: 'Does it work outside English?',
      a: 'Yes. The product interface is built for global use, and the AI writer handles 100+ languages natively rather than translating from English.',
    },
    {
      q: 'Do I need a computer?',
      a: 'No. iOS and Android apps carry the full compose, schedule and approve flows. The queue itself runs in the cloud, so no device needs to stay open.',
    },
    {
      q: 'Is it usable with a keyboard or screen reader?',
      a: 'Flows are keyboard-operable, contrast is checked in both themes, and alt text is part of the compose flow because several networks treat it as required.',
    },
  ],
  ctaTitle: 'Start free. Stay free as long as it fits.',
  ctaBody: 'No card, no trial clock. Connect three channels and schedule your first month today.',
};

export type MadeForEveryoneCopy = typeof en;

const es: MadeForEveryoneCopy = {
  metaTitle: 'Programador de redes sociales asequible en más de 100 idiomas',
  metaDesc:
    'Un plan gratuito que sigue siendo gratis, más de 100 idiomas, accesibilidad real y apps para iOS, Android y web. Programación de redes sociales para todos.',
  kicker: 'Hecho para todos',
  title: 'Publicar no debería ser un privilegio.',
  lede: 'Las herramientas para publicar a diario se volvieron caras, pensadas primero en inglés y solo para ordenador. Sosial es lo contrario: un plan gratuito que sigue siendo gratis, cien idiomas y la misma app en tu bolsillo que en tu escritorio.',
  stats: [
    { value: '100+', label: 'Idiomas en los que el redactor con IA escribe de forma nativa.' },
    { value: '3', label: 'Formas de entrar: iOS, Android y web, en un mismo espacio de trabajo.' },
    { value: 'Gratis', label: 'Plan sin tarjeta, sin periodo de prueba y sin fecha de fin.' },
    { value: '0', label: 'Dispositivos que deben quedarse encendidos para que salgan las publicaciones.' },
  ],
  who: {
    kicker: 'Para quién es',
    title: 'Un espacio de trabajo, trabajos muy distintos.',
    lede: 'Solo, equipo pequeño o agencia: el mismo editor, calendario y cola, con roles donde los necesites.',
    items: [
      { title: 'Creadores y fundadores', body: 'Una persona, muchos canales, sin equipo. Escribe por la mañana, deja que la cola publique durante el día y guarda la tarde para el trabajo de verdad.', linkLabel: 'Ver el editor' },
      { title: 'Equipos pequeños', body: 'Alguien de marketing, alguien que escribe y un fundador que quiere aprobar. Los miembros redactan, los administradores publican y los propietarios gestionan cuentas y facturación.', linkLabel: 'Conoce el redactor con IA' },
      { title: 'Agencias y freelancers', body: 'Muchos clientes, límites claros. Mantén cada espacio de trabajo separado, programa en todas las redes e informa con analíticas reales.', linkLabel: 'Ver la publicación' },
    ],
  },
  access: {
    kicker: 'Integrado, no añadido',
    title: 'La accesibilidad es parte del producto.',
    lede: 'Idioma, dispositivos y accesibilidad vienen de serie, no en un nivel premium.',
    items: [
      { title: 'Primero tu idioma', body: 'El redactor con IA elige entre más de 100 idiomas antes de escribir, así que el resultado es nativo y no traducido. Inglés, malayo, tamil y muchos más, con vistas previas en tu alfabeto.' },
      { title: 'Móvil, tablet y ordenador, por igual', body: 'iOS, Android y la web comparten el mismo espacio de trabajo y la misma cola. Aprueba una publicación en el tren; el servicio la publica a tiempo con el portátil cerrado.' },
      { title: 'Hecho para usarse', body: 'Contraste comprobado en modo claro y oscuro, cada flujo usable con teclado y avisos de texto alternativo donde las redes lo esperan.' },
      { title: 'Gratis es gratis', body: 'Tres canales y un mes de publicaciones programadas no cuestan nada. Cuando se te quede pequeño, los precios de pago están en una página que puedes leer antes de registrarte.' },
    ],
  },
  basics: {
    kicker: 'Todos los planes',
    title: 'Lo básico nunca va detrás de un muro de pago.',
    items: ['Calendario y cola', 'Vistas previas y límites por canal', 'iOS, Android y web', 'Tus datos, exportables cuando los pidas'],
  },
  faq: [
    { q: '¿El plan gratuito es una prueba?', a: 'No. Tiene límites (3 canales, 10 publicaciones programadas por canal y 20 créditos de IA al mes) y no tiene fecha de fin. Los créditos se renuevan el día 1, mejores de plan o no.' },
    { q: '¿Funciona en otros idiomas además del inglés?', a: 'Sí. La interfaz está pensada para uso global y el redactor con IA escribe de forma nativa en más de 100 idiomas, sin traducir desde el inglés.' },
    { q: '¿Necesito un ordenador?', a: 'No. Las apps de iOS y Android incluyen todo para redactar, programar y aprobar. La cola funciona en la nube, así que ningún dispositivo tiene que quedarse abierto.' },
    { q: '¿Se puede usar con teclado o lector de pantalla?', a: 'Los flujos se pueden usar con teclado, el contraste se comprueba en ambos temas y el texto alternativo forma parte de la redacción porque varias redes lo consideran obligatorio.' },
  ],
  ctaTitle: 'Empieza gratis. Sigue gratis mientras te sirva.',
  ctaBody: 'Sin tarjeta, sin periodo de prueba. Conecta tres canales y programa tu primer mes hoy.',
};

const fr: MadeForEveryoneCopy = {
  metaTitle: 'Planificateur de réseaux sociaux abordable, en plus de 100 langues',
  metaDesc:
    'Une offre gratuite qui le reste, plus de 100 langues, une vraie accessibilité et des applis iOS, Android et web. La planification des réseaux sociaux pour tous.',
  kicker: 'Conçu pour tous',
  title: 'Publier ne devrait pas être un privilège.',
  lede: 'Les outils de publication quotidienne sont devenus chers, pensés d’abord en anglais et réservés à l’ordinateur. Sosial fait l’inverse : une offre gratuite qui le reste, cent langues et la même application dans votre poche que sur votre bureau.',
  stats: [
    { value: '100+', label: 'Langues dans lesquelles le rédacteur IA écrit nativement.' },
    { value: '3', label: 'Accès : iOS, Android et le web, sur un même espace de travail.' },
    { value: 'Gratuit', label: 'Offre sans carte, sans période d’essai et sans date de fin.' },
    { value: '0', label: 'Appareil qui doit rester allumé pour que les publications partent.' },
  ],
  who: {
    kicker: 'Pour qui',
    title: 'Un espace de travail, des métiers très différents.',
    lede: 'Solo, petite équipe ou agence : le même éditeur, le même calendrier et la même file, avec des rôles là où il en faut.',
    items: [
      { title: 'Créateurs et fondateurs', body: 'Une personne, beaucoup de canaux, pas d’équipe. Écrivez le matin, laissez la file publier dans la journée et gardez la soirée pour le vrai travail.', linkLabel: 'Voir l’éditeur' },
      { title: 'Petites équipes', body: 'Un marketeur, un rédacteur et un fondateur qui veut valider. Les membres rédigent, les administrateurs publient, les propriétaires gèrent les comptes et la facturation.', linkLabel: 'Découvrir le rédacteur IA' },
      { title: 'Agences et freelances', body: 'Beaucoup de clients, des frontières nettes. Gardez chaque espace de travail séparé, planifiez sur tous les réseaux et rendez compte avec de vraies statistiques.', linkLabel: 'Voir la publication' },
    ],
  },
  access: {
    kicker: 'Intégré, pas ajouté',
    title: 'L’accessibilité fait partie du produit.',
    lede: 'Langue, appareils et accessibilité sont inclus d’office, pas réservés à une offre premium.',
    items: [
      { title: 'Votre langue d’abord', body: 'Le rédacteur IA choisit parmi plus de 100 langues avant d’écrire : le résultat est natif, pas traduit. Anglais, malais, tamoul et bien d’autres, avec des aperçus dans votre écriture.' },
      { title: 'Téléphone, tablette, bureau : à égalité', body: 'iOS, Android et le web partagent le même espace de travail et la même file. Validez une publication dans le train ; le service la publie à l’heure, ordinateur fermé.' },
      { title: 'Fait pour être utilisé', body: 'Contraste vérifié en mode clair et sombre, chaque parcours utilisable au clavier, et rappels de texte alternatif là où les réseaux l’attendent.' },
      { title: 'Gratuit veut dire gratuit', body: 'Trois canaux et un mois de publications planifiées ne coûtent rien. Quand vous voyez plus grand, les tarifs payants sont sur une page lisible avant l’inscription.' },
    ],
  },
  basics: {
    kicker: 'Toutes les offres',
    title: 'L’essentiel n’est jamais payant.',
    items: ['Calendrier et file', 'Aperçus et limites par canal', 'iOS, Android et web', 'Vos données, exportables sur demande'],
  },
  faq: [
    { q: 'L’offre gratuite est-elle un essai ?', a: 'Non. Elle a des limites (3 canaux, 10 publications planifiées par canal, 20 crédits IA par mois) et aucune date de fin. Les crédits se renouvellent le 1er, que vous passiez à une offre payante ou non.' },
    { q: 'Fonctionne-t-il dans d’autres langues que l’anglais ?', a: 'Oui. L’interface est pensée pour un usage mondial, et le rédacteur IA écrit nativement dans plus de 100 langues au lieu de traduire depuis l’anglais.' },
    { q: 'Ai-je besoin d’un ordinateur ?', a: 'Non. Les applis iOS et Android permettent de rédiger, planifier et valider entièrement. La file tourne dans le cloud : aucun appareil ne doit rester ouvert.' },
    { q: 'Est-il utilisable au clavier ou avec un lecteur d’écran ?', a: 'Les parcours sont utilisables au clavier, le contraste est vérifié dans les deux thèmes, et le texte alternatif fait partie de la rédaction car plusieurs réseaux l’exigent.' },
  ],
  ctaTitle: 'Commencez gratuitement. Restez-y tant que ça vous convient.',
  ctaBody: 'Sans carte, sans période d’essai. Connectez trois canaux et planifiez votre premier mois dès aujourd’hui.',
};

const de: MadeForEveryoneCopy = {
  metaTitle: 'Günstiger Social-Media-Planer in über 100 Sprachen',
  metaDesc:
    'Ein Gratis-Plan, der gratis bleibt, über 100 Sprachen, echte Barrierefreiheit und Apps für iOS, Android und das Web. Social-Media-Planung für alle.',
  kicker: 'Für alle gemacht',
  title: 'Veröffentlichen sollte kein Privileg sein.',
  lede: 'Die Werkzeuge fürs tägliche Posten wurden teuer, englischlastig und nur für den Desktop gebaut. Sosial ist das Gegenteil: ein Gratis-Plan, der gratis bleibt, hundert Sprachen und dieselbe App in der Tasche wie am Schreibtisch.',
  stats: [
    { value: '100+', label: 'Sprachen, in denen der KI-Texter muttersprachlich schreibt.' },
    { value: '3', label: 'Zugänge: iOS, Android und das Web, in einem Workspace.' },
    { value: 'Gratis', label: 'Plan ohne Karte, ohne Testphase und ohne Enddatum.' },
    { value: '0', label: 'Geräte, die eingeschaltet bleiben müssen, damit Beiträge rausgehen.' },
  ],
  who: {
    kicker: 'Für wen',
    title: 'Ein Workspace, sehr unterschiedliche Aufgaben.',
    lede: 'Allein, kleines Team oder Agentur: derselbe Editor, Kalender und dieselbe Warteschlange, mit Rollen, wo du sie brauchst.',
    items: [
      { title: 'Creator und Gründer', body: 'Eine Person, viele Kanäle, kein Team. Morgens schreiben, die Warteschlange über den Tag veröffentlichen lassen und den Abend für die eigentliche Arbeit freihalten.', linkLabel: 'Den Editor ansehen' },
      { title: 'Kleine Teams', body: 'Eine Marketerin, ein Texter und eine Gründerin, die freigeben will. Mitglieder entwerfen, Admins veröffentlichen, Inhaber verwalten Konten und Abrechnung.', linkLabel: 'Den KI-Texter kennenlernen' },
      { title: 'Agenturen und Freelancer', body: 'Viele Kunden, klare Grenzen. Halte jeden Workspace getrennt, plane auf allen Netzwerken und berichte mit echten Analysen.', linkLabel: 'Veröffentlichen ansehen' },
    ],
  },
  access: {
    kicker: 'Eingebaut, nicht angeschraubt',
    title: 'Zugang ist Teil des Produkts.',
    lede: 'Sprache, Geräte und Barrierefreiheit sind Standard, keine Premium-Stufe.',
    items: [
      { title: 'Zuerst deine Sprache', body: 'Der KI-Texter wählt aus über 100 Sprachen, bevor er schreibt. So ist das Ergebnis muttersprachlich statt übersetzt. Englisch, Malaiisch, Tamil und mehr, mit Vorschau in deiner Schrift.' },
      { title: 'Handy, Tablet, Schreibtisch: gleichwertig', body: 'iOS, Android und das Web nutzen denselben Workspace und dieselbe Warteschlange. Gib einen Beitrag im Zug frei; der Dienst veröffentlicht ihn pünktlich, auch bei zugeklapptem Laptop.' },
      { title: 'Gemacht, um benutzt zu werden', body: 'Kontrast geprüft in Hell und Dunkel, jeder Ablauf per Tastatur bedienbar und Hinweise für Alternativtext, wo Netzwerke ihn erwarten.' },
      { title: 'Gratis heißt gratis', body: 'Drei Kanäle und ein Monat geplanter Beiträge kosten nichts. Wenn du mehr brauchst, stehen die Preise auf einer Seite, die du vor der Anmeldung lesen kannst.' },
    ],
  },
  basics: {
    kicker: 'Jeder Plan',
    title: 'Die Grundlagen sind nie hinter einer Bezahlschranke.',
    items: ['Kalender und Warteschlange', 'Vorschauen und Limits pro Kanal', 'iOS, Android und Web', 'Deine Daten, auf Anfrage exportierbar'],
  },
  faq: [
    { q: 'Ist der Gratis-Plan eine Testphase?', a: 'Nein. Er hat Limits (3 Kanäle, 10 geplante Beiträge pro Kanal, 20 KI-Credits im Monat) und kein Enddatum. Die Credits werden am 1. zurückgesetzt, ob du upgradest oder nicht.' },
    { q: 'Funktioniert es auch außerhalb von Englisch?', a: 'Ja. Die Oberfläche ist für den weltweiten Einsatz gebaut, und der KI-Texter schreibt muttersprachlich in über 100 Sprachen, statt aus dem Englischen zu übersetzen.' },
    { q: 'Brauche ich einen Computer?', a: 'Nein. Die Apps für iOS und Android können vollständig schreiben, planen und freigeben. Die Warteschlange läuft in der Cloud, also muss kein Gerät an bleiben.' },
    { q: 'Ist es mit Tastatur oder Screenreader nutzbar?', a: 'Die Abläufe sind per Tastatur bedienbar, der Kontrast ist in beiden Themes geprüft, und Alternativtext gehört zum Schreiben dazu, weil mehrere Netzwerke ihn verlangen.' },
  ],
  ctaTitle: 'Gratis starten. Gratis bleiben, solange es passt.',
  ctaBody: 'Keine Karte, keine Testphase. Verbinde drei Kanäle und plane noch heute deinen ersten Monat.',
};

const ja: MadeForEveryoneCopy = {
  metaTitle: '100以上の言語に対応した手頃なSNS予約投稿ツール',
  metaDesc:
    'ずっと無料の無料プラン、100以上の言語、実用的なアクセシビリティ、iOS・Android・ウェブのアプリ。すべての人のためのSNS予約投稿。',
  kicker: 'すべての人のために',
  title: '発信は、特権であってはならない。',
  lede: '毎日の投稿を支えるツールは、高価で、英語優先で、パソコン専用になってしまいました。Sosialはその逆です。ずっと無料の無料プラン、100の言語、そしてポケットにもデスクにも同じアプリを。',
  stats: [
    { value: '100+', label: 'AIライターがネイティブに書ける言語。' },
    { value: '3', label: 'iOS、Android、ウェブの3つの入口。1つのワークスペースで。' },
    { value: '無料', label: 'カード不要、試用期間なし、期限なしのプラン。' },
    { value: '0', label: '投稿のために電源を入れておく必要がある端末。' },
  ],
  who: {
    kicker: '対象',
    title: '1つのワークスペースで、まったく違う仕事を。',
    lede: '個人でも、小さなチームでも、代理店でも。同じエディター、カレンダー、キューに、必要な場所で権限を。',
    items: [
      { title: 'クリエイターと創業者', body: '1人で多くのチャネルを運用。朝に書けば、日中はキューが公開してくれるので、夜は本来の仕事に使えます。', linkLabel: 'エディターを見る' },
      { title: '小さなチーム', body: 'マーケター、ライター、そして承認したい創業者。メンバーが下書きし、管理者が公開し、オーナーがアカウントと請求を管理します。', linkLabel: 'AIライターを見る' },
      { title: '代理店とフリーランス', body: '多くのクライアントを、はっきり区切って。ワークスペースを分け、すべてのネットワークに予約し、実際の分析でレポートできます。', linkLabel: '投稿機能を見る' },
    ],
  },
  access: {
    kicker: '後付けではなく標準装備',
    title: '使いやすさは製品の一部。',
    lede: '言語、デバイス、アクセシビリティは標準機能。上位プラン限定ではありません。',
    items: [
      { title: 'まずあなたの言語で', body: 'AIライターは書く前に100以上の言語から選ぶので、翻訳ではなくネイティブな文章になります。英語、マレー語、タミル語などに対応し、あなたの文字でプレビューできます。' },
      { title: 'スマホもタブレットもPCも同じように', body: 'iOS、Android、ウェブが同じワークスペースとキューを使います。電車の中で投稿を承認しても、ノートPCを閉じたまま時間どおりに公開されます。' },
      { title: '使われるために作られている', body: 'ライト・ダークの両方でコントラストを確認し、すべての操作をキーボードで行えます。ネットワークが求める場面では代替テキストの入力を促します。' },
      { title: '無料は本当に無料', body: '3つのチャネルと1か月分の予約投稿は無料です。物足りなくなったら、登録前に読める料金ページで有料プランを確認できます。' },
    ],
  },
  basics: {
    kicker: 'すべてのプラン',
    title: '基本機能は決して有料にしません。',
    items: ['カレンダーとキュー', 'チャネル別のプレビューと制限', 'iOS、Android、ウェブ', 'ご依頼に応じてデータをエクスポート'],
  },
  faq: [
    { q: '無料プランはお試し版ですか？', a: 'いいえ。上限（3チャネル、チャネルごとに10件の予約投稿、月20AIクレジット）はありますが、期限はありません。クレジットはアップグレードの有無にかかわらず毎月1日にリセットされます。' },
    { q: '英語以外でも使えますか？', a: 'はい。インターフェースは世界中で使えるように作られており、AIライターは英語から翻訳するのではなく、100以上の言語でネイティブに書きます。' },
    { q: 'パソコンは必要ですか？', a: 'いいえ。iOSとAndroidのアプリで、作成・予約・承認のすべてができます。キューはクラウドで動くため、端末を開いたままにする必要はありません。' },
    { q: 'キーボードやスクリーンリーダーで使えますか？', a: 'すべての操作がキーボードで行え、両方のテーマでコントラストを確認しています。いくつかのネットワークで必須のため、代替テキストも作成画面に組み込まれています。' },
  ],
  ctaTitle: '無料で始めて、合う限り無料のまま。',
  ctaBody: 'カード不要、試用期間なし。3つのチャネルを接続して、今日から最初の1か月を予約しましょう。',
};

const ko: MadeForEveryoneCopy = {
  metaTitle: '100개 이상의 언어를 지원하는 합리적인 소셜 미디어 예약 도구',
  metaDesc:
    '계속 무료인 무료 요금제, 100개 이상의 언어, 실질적인 접근성, iOS·Android·웹 앱. 모두를 위한 소셜 미디어 예약.',
  kicker: '모두를 위해',
  title: '게시는 특권이 되어선 안 됩니다.',
  lede: '매일 게시하는 데 쓰는 도구는 비싸지고, 영어 위주가 되고, 데스크톱 전용이 되었습니다. Sosial은 그 반대예요. 계속 무료인 무료 요금제, 100개의 언어, 그리고 주머니 속에서도 책상 위에서도 같은 앱.',
  stats: [
    { value: '100+', label: 'AI 작성 도우미가 원어민처럼 쓰는 언어.' },
    { value: '3', label: 'iOS, Android, 웹. 하나의 워크스페이스로 들어가는 세 가지 길.' },
    { value: '무료', label: '카드도, 체험 기간도, 종료일도 없는 요금제.' },
    { value: '0', label: '게시물이 나가려면 켜 두어야 하는 기기 수.' },
  ],
  who: {
    kicker: '이런 분께',
    title: '하나의 워크스페이스, 전혀 다른 일들.',
    lede: '혼자든, 작은 팀이든, 에이전시든 같은 작성기, 캘린더, 대기열을 쓰고, 필요한 곳에 역할을 둡니다.',
    items: [
      { title: '크리에이터와 창업자', body: '한 사람, 여러 채널, 팀 없음. 아침에 쓰고 낮에는 대기열에 맡기고, 저녁은 진짜 일을 위해 남겨 두세요.', linkLabel: '작성기 보기' },
      { title: '작은 팀', body: '마케터, 작가, 그리고 승인하고 싶은 창업자. 멤버는 초안을 쓰고, 관리자는 게시하고, 소유자는 계정과 결제를 관리합니다.', linkLabel: 'AI 작성 도우미 보기' },
      { title: '에이전시와 프리랜서', body: '많은 고객, 분명한 경계. 워크스페이스를 고객별로 나누고, 모든 네트워크에 예약하고, 실제 분석으로 보고하세요.', linkLabel: '게시 기능 보기' },
    ],
  },
  access: {
    kicker: '덧붙인 게 아니라 기본으로',
    title: '접근성은 제품의 일부입니다.',
    lede: '언어, 기기, 접근성은 기본 제공이지 프리미엄 등급이 아닙니다.',
    items: [
      { title: '내 언어부터', body: 'AI 작성 도우미는 쓰기 전에 100개 이상의 언어 중에서 고르니 번역이 아닌 원어민 수준의 결과가 나옵니다. 영어, 말레이어, 타밀어 등 다양한 언어를 내 문자로 미리 볼 수 있어요.' },
      { title: '휴대폰, 태블릿, 데스크톱 모두 똑같이', body: 'iOS, Android, 웹이 같은 워크스페이스와 대기열을 씁니다. 기차에서 게시물을 승인해도, 노트북을 닫은 채로 제시간에 게시됩니다.' },
      { title: '쓰라고 만든 도구', body: '밝은 테마와 어두운 테마 모두에서 대비를 확인하고, 모든 흐름을 키보드로 쓸 수 있으며, 네트워크가 요구하는 곳에서 대체 텍스트를 안내합니다.' },
      { title: '무료는 정말 무료', body: '채널 3개와 한 달 치 예약 게시물은 무료입니다. 더 필요해지면 가입 전에 읽을 수 있는 페이지에 유료 요금이 나와 있어요.' },
    ],
  },
  basics: {
    kicker: '모든 요금제',
    title: '기본 기능은 절대 유료로 막지 않습니다.',
    items: ['캘린더와 대기열', '채널별 미리 보기와 제한', 'iOS, Android, 웹', '요청하면 데이터 내보내기'],
  },
  faq: [
    { q: '무료 요금제는 체험판인가요?', a: '아니요. 제한(채널 3개, 채널당 예약 게시물 10개, 월 AI 크레딧 20개)은 있지만 종료일은 없습니다. 크레딧은 업그레이드 여부와 관계없이 매월 1일에 초기화됩니다.' },
    { q: '영어가 아닌 언어로도 쓸 수 있나요?', a: '네. 인터페이스는 전 세계에서 쓰도록 만들어졌고, AI 작성 도우미는 영어를 번역하지 않고 100개 이상의 언어로 직접 씁니다.' },
    { q: '컴퓨터가 있어야 하나요?', a: '아니요. iOS와 Android 앱에서 작성, 예약, 승인을 모두 할 수 있어요. 대기열은 클라우드에서 돌아가니 기기를 켜 둘 필요가 없습니다.' },
    { q: '키보드나 스크린 리더로 쓸 수 있나요?', a: '모든 흐름을 키보드로 쓸 수 있고, 두 테마 모두에서 대비를 확인했으며, 여러 네트워크에서 필수이기 때문에 대체 텍스트도 작성 과정에 들어 있습니다.' },
  ],
  ctaTitle: '무료로 시작하고, 맞는 동안은 계속 무료로.',
  ctaBody: '카드도, 체험 기간도 없습니다. 채널 3개를 연결하고 오늘 첫 달을 예약하세요.',
};

const zh: MadeForEveryoneCopy = {
  metaTitle: '支持 100 多种语言的平价社交媒体排期工具',
  metaDesc: '一直免费的免费计划、100 多种语言、真正的无障碍设计，以及 iOS、Android 和网页应用。为每个人打造的社交媒体排期工具。',
  kicker: '为每个人打造',
  title: '发布内容不应是特权。',
  lede: '日常发帖用的工具变得昂贵、以英语为先、只能在电脑上用。Sosial 恰恰相反：一直免费的免费计划、一百种语言，口袋里和桌面上是同一个应用。',
  stats: [
    { value: '100+', label: '种 AI 写作助手能原生撰写的语言。' },
    { value: '3', label: '种使用方式：iOS、Android 和网页，共用一个工作区。' },
    { value: '免费', label: '计划：无需绑卡，没有试用期，也没有截止日期。' },
    { value: '0', label: '台需要保持开机才能发帖的设备。' },
  ],
  who: {
    kicker: '适合谁',
    title: '同一个工作区，完全不同的工作。',
    lede: '个人、小团队或代理机构：同样的编辑器、日历和队列，在需要的地方设置角色。',
    items: [
      { title: '创作者和创始人', body: '一个人，多个渠道，没有团队。早上写好，白天交给队列发布，晚上留给真正的工作。', linkLabel: '查看编辑器' },
      { title: '小团队', body: '一位营销、一位写手，再加一位想要审批的创始人。成员起草，管理员发布，所有者管理账号和账单。', linkLabel: '了解 AI 写作助手' },
      { title: '代理机构和自由职业者', body: '客户众多，边界清晰。每个工作区相互独立，排期到所有网络，并用真实数据出报告。', linkLabel: '查看发布功能' },
    ],
  },
  access: {
    kicker: '内置，而非外挂',
    title: '易用性是产品的一部分。',
    lede: '语言、设备和无障碍是默认功能，而不是高级版专属。',
    items: [
      { title: '先用你的语言', body: 'AI 写作助手在动笔前从 100 多种语言中选择，产出是原生内容而非翻译。英语、马来语、泰米尔语等，并以你的文字预览。' },
      { title: '手机、平板、电脑一视同仁', body: 'iOS、Android 和网页共用同一个工作区和队列。在地铁上批准一条帖子，即使笔记本合上，服务也会准时发布。' },
      { title: '为使用而设计', body: '浅色和深色模式下都检查过对比度，每个流程都能用键盘完成，并在网络需要时提示填写替代文本。' },
      { title: '免费就是免费', body: '三个渠道和一个月的排期帖子完全免费。需要更多时，付费价格就在一个注册前就能看的页面上。' },
    ],
  },
  basics: {
    kicker: '所有计划',
    title: '基础功能永远不收费。',
    items: ['日历和队列', '按渠道的预览和限制', 'iOS、Android 和网页', '你的数据，可按需导出'],
  },
  faq: [
    { q: '免费计划是试用吗？', a: '不是。它有额度限制（3 个渠道、每个渠道 10 条排期帖子、每月 20 个 AI 点数），但没有截止日期。无论是否升级，点数都会在每月 1 日重置。' },
    { q: '英语以外的语言能用吗？', a: '能。界面为全球使用而设计，AI 写作助手以 100 多种语言原生撰写，而不是从英语翻译。' },
    { q: '需要电脑吗？', a: '不需要。iOS 和 Android 应用可以完成全部撰写、排期和审批。队列在云端运行，不需要任何设备一直开着。' },
    { q: '能用键盘或读屏软件操作吗？', a: '所有流程都能用键盘操作，两种主题都检查过对比度，替代文本也是撰写流程的一部分，因为好几个网络要求必须填写。' },
  ],
  ctaTitle: '免费开始，合适就一直免费。',
  ctaBody: '无需绑卡，没有试用期。连接三个渠道，今天就排好第一个月。',
};

export const madeForEveryoneCopy: Record<Locale, MadeForEveryoneCopy> = { en, es, fr, de, ja, ko, zh };
