import type { Locale } from '@/lib/i18n/locales';

/** /ai-assistant copy in every locale (see content/pages/features.ts). */

const en = {
  metaTitle: 'AI social media post writer with live research',
  metaDesc:
    'Draft captions and threads in 100+ languages, grounded by live web research with linked sources. Rewrites in your voice. Nothing publishes without you.',
  kicker: 'AI Assistant',
  title: 'A writer that checks its facts.',
  lede: 'Rough thought in, post-ready caption out. Grounded by live research with linked sources, written in your style, in 100+ languages. Nothing publishes without you.',
  seeComposer: 'See the composer',
  heroCaption: 'The AI writer sits beside the composer: idea in, draft out, nothing posts without you.',
  crumbFeatures: 'Features',
  how: {
    kicker: 'How it works',
    title: 'From a rough idea to a post you approve.',
    lede: 'The assistant drafts. You decide. Every step stays visible, and nothing reaches a network until you schedule it yourself.',
    steps: [
      { title: 'Start with an idea', body: 'A sentence, a link or a messy note. Pick the language first, then the tone and style.' },
      { title: 'It researches', body: 'With research on, it reads the live web before writing and keeps the sources it used.' },
      { title: 'It drafts', body: 'A caption or a full thread, shaped for each channel you picked, with uncertain claims flagged.' },
      { title: 'You approve', body: 'Edit anything, then schedule it. The assistant can draft, but it can never publish.' },
    ],
  },
  research: {
    kicker: 'Research',
    title: 'Grounded, not guessed.',
    body: 'Turn on research and the writer searches the live web before drafting, then hands you the copy alongside the sources it used and flags anything uncertain. News-driven posts finally have receipts.',
    points: ['Live web research before drafting', 'Sources returned with every draft', 'Uncertainties flagged instead of smoothed over'],
    caption: 'Language, tone, style, format and structure, all before you generate.',
  },
  writing: {
    kicker: 'Writing',
    title: 'Sound like you on a good day.',
    lede: 'Styles with real samples, threads that read naturally, and rewrites that keep your voice.',
    items: [
      {
        title: 'Your language first',
        body: 'Pick from 100+ languages before anything is generated, so the draft is native, not translated from English.',
      },
      { title: 'Style cards', body: 'Breaking news, threads, teardowns and more, each with a live sample of what it produces.' },
      {
        title: 'Real threads',
        body: 'Long ideas become multi-post threads, split where a reader would pause and never padded for length.',
      },
      { title: 'Rewrites on demand', body: 'Paste a rough note or a published post and get a second draft in your voice.' },
      { title: 'Adapted per channel', body: 'Generate once, then adapt for each network with its limits and conventions respected.' },
      {
        title: 'Never trained on you',
        body: 'Your briefs and drafts are not used to train AI models. They serve your workspace and nothing else.',
      },
    ],
  },
  faq: [
    {
      q: 'Does the AI publish automatically?',
      a: 'Never. It drafts; you approve. Every word passes through you before it can be scheduled, let alone published.',
    },
    {
      q: 'Is my content used to train AI models?',
      a: 'No. Your briefs and drafts are not used to train models. See the privacy policy for the full statement.',
    },
    {
      q: 'Which languages are supported?',
      a: 'More than a hundred, chosen first before anything else is generated, so the draft is native, not translated.',
    },
    {
      q: 'What happens when facts are uncertain?',
      a: 'The writer says so: uncertainties are flagged and sources are linked, so you can verify before posting.',
    },
    {
      q: 'Can it adapt one idea to all ten channels?',
      a: 'Yes. Generate once, then adapt per channel with each network’s limits and conventions respected.',
    },
  ],
  ctaTitle: 'Your ideas, written up and fact-checked.',
  ctaBody: 'Bring the rough thought. The assistant does the first draft and the research; you keep the final say on every word.',
};

export type AiAssistantCopy = typeof en;

const es: AiAssistantCopy = {
  metaTitle: 'Redactor de publicaciones con IA e investigación en vivo',
  metaDesc:
    'Redacta textos e hilos en más de 100 idiomas, basados en investigación web en vivo con fuentes enlazadas. Reescribe con tu voz. Nada se publica sin ti.',
  kicker: 'Asistente de IA',
  title: 'Un redactor que comprueba los datos.',
  lede: 'Entra una idea a medias, sale un texto listo para publicar. Basado en investigación en vivo con fuentes enlazadas, escrito con tu estilo, en más de 100 idiomas. Nada se publica sin ti.',
  seeComposer: 'Ver el editor',
  heroCaption: 'El redactor con IA está junto al editor: entra una idea, sale un borrador y nada se publica sin ti.',
  crumbFeatures: 'Funciones',
  how: {
    kicker: 'Cómo funciona',
    title: 'De una idea a medias a una publicación que apruebas.',
    lede: 'El asistente redacta. Tú decides. Cada paso queda a la vista y nada llega a una red hasta que tú lo programas.',
    steps: [
      { title: 'Empieza con una idea', body: 'Una frase, un enlace o una nota desordenada. Elige primero el idioma, después el tono y el estilo.' },
      { title: 'Investiga', body: 'Con la investigación activada, lee la web en vivo antes de escribir y guarda las fuentes que usó.' },
      { title: 'Redacta', body: 'Un texto o un hilo completo, adaptado a cada canal elegido, con las afirmaciones dudosas señaladas.' },
      { title: 'Tú apruebas', body: 'Edita lo que quieras y prográmalo. El asistente puede redactar, pero nunca publicar.' },
    ],
  },
  research: {
    kicker: 'Investigación',
    title: 'Con fundamento, no a ciegas.',
    body: 'Activa la investigación y el redactor busca en la web en vivo antes de escribir; luego te entrega el texto con las fuentes que usó y señala lo que no es seguro. Por fin, publicaciones de actualidad con pruebas.',
    points: ['Investigación web en vivo antes de redactar', 'Fuentes incluidas con cada borrador', 'Las dudas se señalan en vez de disimularse'],
    caption: 'Idioma, tono, estilo, formato y estructura, todo antes de generar.',
  },
  writing: {
    kicker: 'Redacción',
    title: 'Suena como tú en un buen día.',
    lede: 'Estilos con ejemplos reales, hilos que se leen con naturalidad y reescrituras que mantienen tu voz.',
    items: [
      { title: 'Primero tu idioma', body: 'Elige entre más de 100 idiomas antes de generar nada, para que el borrador sea nativo y no una traducción del inglés.' },
      { title: 'Tarjetas de estilo', body: 'Última hora, hilos, análisis a fondo y más, cada uno con un ejemplo en vivo de lo que produce.' },
      { title: 'Hilos de verdad', body: 'Las ideas largas se convierten en hilos de varias publicaciones, divididos donde el lector haría una pausa y sin relleno.' },
      { title: 'Reescrituras al momento', body: 'Pega una nota a medias o una publicación ya hecha y obtén un segundo borrador con tu voz.' },
      { title: 'Adaptado a cada canal', body: 'Genera una vez y adapta a cada red respetando sus límites y costumbres.' },
      { title: 'Nunca entrenado contigo', body: 'Tus indicaciones y borradores no se usan para entrenar modelos de IA. Solo sirven a tu espacio de trabajo.' },
    ],
  },
  faq: [
    { q: '¿La IA publica automáticamente?', a: 'Nunca. Redacta; tú apruebas. Cada palabra pasa por ti antes de poder programarse, y mucho menos publicarse.' },
    { q: '¿Se usa mi contenido para entrenar modelos de IA?', a: 'No. Tus indicaciones y borradores no se usan para entrenar modelos. Consulta la política de privacidad para la declaración completa.' },
    { q: '¿Qué idiomas admite?', a: 'Más de cien, que eliges antes de generar nada, para que el borrador sea nativo y no traducido.' },
    { q: '¿Qué pasa cuando los datos no son seguros?', a: 'El redactor lo dice: las dudas se señalan y las fuentes se enlazan para que puedas verificar antes de publicar.' },
    { q: '¿Puede adaptar una idea a los diez canales?', a: 'Sí. Genera una vez y adapta a cada canal respetando los límites y costumbres de cada red.' },
  ],
  ctaTitle: 'Tus ideas, redactadas y verificadas.',
  ctaBody: 'Trae la idea a medias. El asistente hace el primer borrador y la investigación; tú tienes la última palabra sobre cada frase.',
};

const fr: AiAssistantCopy = {
  metaTitle: 'Rédacteur IA de publications avec recherche en direct',
  metaDesc:
    'Rédigez légendes et threads dans plus de 100 langues, appuyés sur une recherche web en direct avec sources. Réécritures dans votre style. Rien n’est publié sans vous.',
  kicker: 'Assistant IA',
  title: 'Un rédacteur qui vérifie ses faits.',
  lede: 'Une idée brute en entrée, une légende prête à publier en sortie. Appuyée sur une recherche en direct avec sources, écrite dans votre style, dans plus de 100 langues. Rien n’est publié sans vous.',
  seeComposer: 'Voir l’éditeur',
  heroCaption: 'Le rédacteur IA se trouve à côté de l’éditeur : une idée entre, un brouillon sort, rien n’est publié sans vous.',
  crumbFeatures: 'Fonctionnalités',
  how: {
    kicker: 'Comment ça marche',
    title: 'D’une idée brute à une publication que vous validez.',
    lede: 'L’assistant rédige. Vous décidez. Chaque étape reste visible, et rien n’atteint un réseau tant que vous ne l’avez pas planifié.',
    steps: [
      { title: 'Partez d’une idée', body: 'Une phrase, un lien ou une note en vrac. Choisissez d’abord la langue, puis le ton et le style.' },
      { title: 'Il se documente', body: 'Recherche activée, il lit le web en direct avant d’écrire et garde les sources utilisées.' },
      { title: 'Il rédige', body: 'Une légende ou un thread complet, adapté à chaque canal choisi, avec les affirmations incertaines signalées.' },
      { title: 'Vous validez', body: 'Modifiez ce que vous voulez, puis planifiez. L’assistant peut rédiger, jamais publier.' },
    ],
  },
  research: {
    kicker: 'Recherche',
    title: 'Sourcé, pas deviné.',
    body: 'Activez la recherche et le rédacteur consulte le web en direct avant d’écrire, puis vous remet le texte avec ses sources et signale ce qui est incertain. Vos publications d’actualité ont enfin des preuves.',
    points: ['Recherche web en direct avant la rédaction', 'Sources fournies avec chaque brouillon', 'Les incertitudes signalées, pas gommées'],
    caption: 'Langue, ton, style, format et structure, tout avant de générer.',
  },
  writing: {
    kicker: 'Écriture',
    title: 'Votre voix, dans un bon jour.',
    lede: 'Des styles avec de vrais exemples, des threads qui se lisent naturellement et des réécritures qui gardent votre voix.',
    items: [
      { title: 'Votre langue d’abord', body: 'Choisissez parmi plus de 100 langues avant toute génération : le brouillon est natif, pas traduit de l’anglais.' },
      { title: 'Fiches de style', body: 'Actualité, threads, analyses détaillées et plus, chacun avec un exemple en direct de ce qu’il produit.' },
      { title: 'De vrais threads', body: 'Les idées longues deviennent des threads en plusieurs publications, coupés là où le lecteur ferait une pause, sans remplissage.' },
      { title: 'Réécritures à la demande', body: 'Collez une note brute ou une publication existante et obtenez une nouvelle version dans votre style.' },
      { title: 'Adapté à chaque canal', body: 'Générez une fois, puis adaptez à chaque réseau en respectant ses limites et ses usages.' },
      { title: 'Jamais entraîné sur vous', body: 'Vos consignes et brouillons ne servent pas à entraîner des modèles d’IA. Ils servent votre espace de travail, rien d’autre.' },
    ],
  },
  faq: [
    { q: 'L’IA publie-t-elle automatiquement ?', a: 'Jamais. Elle rédige ; vous validez. Chaque mot passe par vous avant de pouvoir être planifié, et encore moins publié.' },
    { q: 'Mon contenu sert-il à entraîner des modèles d’IA ?', a: 'Non. Vos consignes et brouillons ne servent pas à entraîner des modèles. Voir la politique de confidentialité pour la déclaration complète.' },
    { q: 'Quelles langues sont prises en charge ?', a: 'Plus d’une centaine, choisies avant toute génération, pour un brouillon natif et non traduit.' },
    { q: 'Que se passe-t-il quand les faits sont incertains ?', a: 'Le rédacteur le dit : les incertitudes sont signalées et les sources liées, pour vérifier avant de publier.' },
    { q: 'Peut-il adapter une idée aux dix canaux ?', a: 'Oui. Générez une fois, puis adaptez à chaque canal en respectant les limites et usages de chaque réseau.' },
  ],
  ctaTitle: 'Vos idées, rédigées et vérifiées.',
  ctaBody: 'Apportez l’idée brute. L’assistant fait le premier jet et la recherche ; vous gardez le dernier mot sur chaque phrase.',
};

const de: AiAssistantCopy = {
  metaTitle: 'KI-Texter für Social-Media-Beiträge mit Live-Recherche',
  metaDesc:
    'Entwirf Texte und Threads in über 100 Sprachen, gestützt auf Live-Webrecherche mit verlinkten Quellen. Umformulierungen in deinem Ton. Ohne dich wird nichts veröffentlicht.',
  kicker: 'KI-Assistent',
  title: 'Ein Texter, der seine Fakten prüft.',
  lede: 'Grobe Idee rein, fertiger Beitragstext raus. Gestützt auf Live-Recherche mit verlinkten Quellen, in deinem Stil, in über 100 Sprachen. Ohne dich wird nichts veröffentlicht.',
  seeComposer: 'Den Editor ansehen',
  heroCaption: 'Der KI-Texter sitzt neben dem Editor: Idee rein, Entwurf raus, ohne dich wird nichts gepostet.',
  crumbFeatures: 'Funktionen',
  how: {
    kicker: 'So funktioniert es',
    title: 'Von der groben Idee zum Beitrag, den du freigibst.',
    lede: 'Der Assistent entwirft. Du entscheidest. Jeder Schritt bleibt sichtbar, und nichts erreicht ein Netzwerk, bevor du es selbst planst.',
    steps: [
      { title: 'Mit einer Idee starten', body: 'Ein Satz, ein Link oder eine wirre Notiz. Wähl zuerst die Sprache, dann Ton und Stil.' },
      { title: 'Er recherchiert', body: 'Mit aktivierter Recherche liest er vor dem Schreiben das Live-Web und behält die genutzten Quellen.' },
      { title: 'Er entwirft', body: 'Ein Text oder ein ganzer Thread, passend für jeden gewählten Kanal, mit markierten unsicheren Aussagen.' },
      { title: 'Du gibst frei', body: 'Bearbeite alles und plane es dann. Der Assistent kann entwerfen, aber niemals veröffentlichen.' },
    ],
  },
  research: {
    kicker: 'Recherche',
    title: 'Belegt statt geraten.',
    body: 'Schalte die Recherche ein und der Texter durchsucht vor dem Entwurf das Live-Web, liefert dir den Text mit den genutzten Quellen und markiert, was unsicher ist. Beiträge zu aktuellen Themen haben endlich Belege.',
    points: ['Live-Webrecherche vor dem Entwurf', 'Quellen zu jedem Entwurf', 'Unsicherheiten markiert statt geglättet'],
    caption: 'Sprache, Ton, Stil, Format und Aufbau, alles vor dem Generieren.',
  },
  writing: {
    kicker: 'Schreiben',
    title: 'Klingt wie du an einem guten Tag.',
    lede: 'Stile mit echten Beispielen, Threads, die sich natürlich lesen, und Umformulierungen, die deinen Ton behalten.',
    items: [
      { title: 'Zuerst deine Sprache', body: 'Wähl aus über 100 Sprachen, bevor etwas generiert wird. So ist der Entwurf muttersprachlich, nicht aus dem Englischen übersetzt.' },
      { title: 'Stilkarten', body: 'Eilmeldung, Threads, Analysen und mehr, jeweils mit einem Live-Beispiel des Ergebnisses.' },
      { title: 'Echte Threads', body: 'Lange Ideen werden zu Threads aus mehreren Beiträgen, geteilt dort, wo man beim Lesen innehält, nie aufgebläht.' },
      { title: 'Umformulieren auf Abruf', body: 'Füg eine grobe Notiz oder einen veröffentlichten Beitrag ein und erhalte einen zweiten Entwurf in deinem Ton.' },
      { title: 'Für jeden Kanal angepasst', body: 'Einmal generieren, dann für jedes Netzwerk anpassen, mit Rücksicht auf dessen Limits und Gepflogenheiten.' },
      { title: 'Nie mit deinen Daten trainiert', body: 'Deine Briefings und Entwürfe werden nicht zum Training von KI-Modellen genutzt. Sie dienen nur deinem Workspace.' },
    ],
  },
  faq: [
    { q: 'Veröffentlicht die KI automatisch?', a: 'Nie. Sie entwirft, du gibst frei. Jedes Wort geht durch deine Hände, bevor es geplant, geschweige denn veröffentlicht werden kann.' },
    { q: 'Werden meine Inhalte zum Training von KI-Modellen genutzt?', a: 'Nein. Deine Briefings und Entwürfe werden nicht zum Training genutzt. Die vollständige Erklärung steht in der Datenschutzerklärung.' },
    { q: 'Welche Sprachen werden unterstützt?', a: 'Über hundert, gewählt bevor etwas generiert wird, damit der Entwurf muttersprachlich und nicht übersetzt ist.' },
    { q: 'Was passiert, wenn Fakten unsicher sind?', a: 'Der Texter sagt es: Unsicherheiten werden markiert und Quellen verlinkt, damit du vor dem Posten prüfen kannst.' },
    { q: 'Kann er eine Idee für alle zehn Kanäle anpassen?', a: 'Ja. Einmal generieren, dann pro Kanal anpassen, mit Rücksicht auf die Limits und Gepflogenheiten jedes Netzwerks.' },
  ],
  ctaTitle: 'Deine Ideen, ausformuliert und geprüft.',
  ctaBody: 'Bring den groben Gedanken mit. Der Assistent macht den ersten Entwurf und die Recherche; das letzte Wort hast du.',
};

const ja: AiAssistantCopy = {
  metaTitle: 'リアルタイム調査付きのAI SNS投稿ライター',
  metaDesc:
    '100以上の言語でキャプションやスレッドを下書き。リンク付きの出典があるリアルタイムのウェブ調査に基づき、あなたの文体でリライト。あなたの確認なしに公開されません。',
  kicker: 'AIアシスタント',
  title: '事実を確かめるライター。',
  lede: '大まかな考えを入れれば、すぐ投稿できるキャプションが出てきます。リンク付きの出典があるリアルタイム調査に基づき、あなたのスタイルで、100以上の言語で。あなたの確認なしに公開されることはありません。',
  seeComposer: 'エディターを見る',
  heroCaption: 'AIライターはエディターの横に。アイデアを入れて下書きを受け取り、あなたの確認なしには投稿されません。',
  crumbFeatures: '機能',
  how: {
    kicker: '仕組み',
    title: '大まかなアイデアから、あなたが承認する投稿へ。',
    lede: 'アシスタントが下書きし、決めるのはあなた。すべての手順が見え、あなたが予約するまでネットワークには届きません。',
    steps: [
      { title: 'アイデアから始める', body: '一文、リンク、まとまっていないメモでもOK。まず言語を選び、次にトーンとスタイルを。' },
      { title: '調査する', body: '調査をオンにすると、書く前にリアルタイムのウェブを読み、使った出典を残します。' },
      { title: '下書きする', body: '選んだチャネルに合わせたキャプションやスレッドを作成し、不確かな主張には印を付けます。' },
      { title: 'あなたが承認', body: '自由に編集して予約。アシスタントは下書きはできますが、公開は決してできません。' },
    ],
  },
  research: {
    kicker: 'リサーチ',
    title: '推測ではなく、根拠に基づく。',
    body: '調査をオンにすると、ライターは下書き前にリアルタイムでウェブを検索し、使った出典と一緒に文章を渡し、不確かな点を示します。ニュースに関する投稿にも、ようやく裏付けが付きます。',
    points: ['下書き前にリアルタイムのウェブ調査', 'すべての下書きに出典付き', '不確かな点はぼかさずに明示'],
    caption: '言語、トーン、スタイル、形式、構成を、すべて生成前に。',
  },
  writing: {
    kicker: '文章',
    title: '調子のいい日のあなたらしく。',
    lede: '実例付きのスタイル、自然に読めるスレッド、あなたの声を保つリライト。',
    items: [
      { title: 'まず言語を選ぶ', body: '生成前に100以上の言語から選べるので、英語からの翻訳ではなく、最初からその言語で書かれた下書きになります。' },
      { title: 'スタイルカード', body: '速報、スレッド、詳しい分析など。それぞれ生成される内容のサンプル付き。' },
      { title: '本物のスレッド', body: '長いアイデアは、読み手が一息つくところで区切った複数投稿のスレッドに。水増しはしません。' },
      { title: 'いつでもリライト', body: '大まかなメモや公開済みの投稿を貼り付ければ、あなたの文体で別バージョンを作成します。' },
      { title: 'チャネルごとに調整', body: '一度生成したら、各ネットワークの制限や慣習に合わせて調整できます。' },
      { title: 'あなたのデータで学習しない', body: '指示や下書きがAIモデルの学習に使われることはありません。あなたのワークスペースのためだけに使われます。' },
    ],
  },
  faq: [
    { q: 'AIが自動で公開することはありますか？', a: 'ありません。AIが下書きし、あなたが承認します。予約される前に、すべての言葉があなたの目を通ります。公開はなおさらです。' },
    { q: '私のコンテンツはAIモデルの学習に使われますか？', a: 'いいえ。指示や下書きがモデルの学習に使われることはありません。詳細はプライバシーポリシーをご覧ください。' },
    { q: '対応言語は？', a: '100以上。生成前に言語を選ぶので、翻訳ではなくその言語で書かれた下書きになります。' },
    { q: '事実が不確かな場合はどうなりますか？', a: 'ライターがそう伝えます。不確かな点には印が付き、出典がリンクされるので、投稿前に確認できます。' },
    { q: '1つのアイデアを10チャネルすべてに合わせられますか？', a: 'はい。一度生成したら、各ネットワークの制限や慣習に合わせてチャネルごとに調整できます。' },
  ],
  ctaTitle: 'あなたのアイデアを、文章にしてファクトチェック。',
  ctaBody: '大まかな考えを持ってきてください。最初の下書きと調査はアシスタントが行い、すべての言葉の最終判断はあなたが下します。',
};

const ko: AiAssistantCopy = {
  metaTitle: '실시간 리서치를 하는 AI 소셜 미디어 작성 도우미',
  metaDesc:
    '100개 이상의 언어로 캡션과 스레드 초안을 작성하세요. 출처 링크가 있는 실시간 웹 리서치를 바탕으로, 내 말투로 다시 씁니다. 승인 없이는 아무것도 게시되지 않아요.',
  kicker: 'AI 어시스턴트',
  title: '사실을 확인하는 작가.',
  lede: '대략적인 생각을 넣으면 바로 올릴 수 있는 캡션이 나옵니다. 출처 링크가 있는 실시간 리서치를 바탕으로, 내 스타일로, 100개 이상의 언어로. 승인 없이는 아무것도 게시되지 않습니다.',
  seeComposer: '작성기 보기',
  heroCaption: 'AI 작성 도우미는 작성기 옆에 있어요. 아이디어를 넣으면 초안이 나오고, 승인 없이는 게시되지 않습니다.',
  crumbFeatures: '기능',
  how: {
    kicker: '작동 방식',
    title: '대략적인 아이디어에서 승인한 게시물까지.',
    lede: '어시스턴트가 초안을 쓰고, 결정은 내가 합니다. 모든 단계가 보이고, 직접 예약하기 전까지 어떤 네트워크에도 올라가지 않아요.',
    steps: [
      { title: '아이디어로 시작', body: '문장 하나, 링크, 정리 안 된 메모도 좋아요. 먼저 언어를 고르고, 그다음 톤과 스타일을 고르세요.' },
      { title: '리서치', body: '리서치를 켜면 쓰기 전에 실시간 웹을 읽고 사용한 출처를 남깁니다.' },
      { title: '초안 작성', body: '고른 채널마다 맞춘 캡션이나 스레드를 쓰고, 불확실한 주장은 표시합니다.' },
      { title: '내가 승인', body: '무엇이든 고친 뒤 예약하세요. 어시스턴트는 초안은 쓰지만 절대 게시하지 못합니다.' },
    ],
  },
  research: {
    kicker: '리서치',
    title: '추측이 아니라 근거로.',
    body: '리서치를 켜면 작성 도우미가 초안 전에 실시간 웹을 검색하고, 사용한 출처와 함께 글을 건네며 불확실한 부분을 표시합니다. 뉴스 관련 게시물에도 드디어 근거가 생겨요.',
    points: ['초안 전 실시간 웹 리서치', '모든 초안에 출처 포함', '불확실한 점은 덮지 않고 표시'],
    caption: '언어, 톤, 스타일, 형식, 구성을 모두 생성 전에.',
  },
  writing: {
    kicker: '글쓰기',
    title: '컨디션 좋은 날의 나처럼.',
    lede: '실제 예시가 있는 스타일, 자연스럽게 읽히는 스레드, 내 말투를 지키는 다시 쓰기.',
    items: [
      { title: '언어부터', body: '생성 전에 100개 이상의 언어 중에서 고르니, 영어를 번역한 글이 아니라 처음부터 그 언어로 쓴 초안이 나옵니다.' },
      { title: '스타일 카드', body: '속보, 스레드, 심층 분석 등. 각각 결과물 예시를 실시간으로 보여줍니다.' },
      { title: '진짜 스레드', body: '긴 아이디어는 독자가 잠시 멈출 곳에서 나눈 여러 게시물의 스레드가 됩니다. 분량을 부풀리지 않아요.' },
      { title: '언제든 다시 쓰기', body: '대충 쓴 메모나 이미 올린 게시물을 붙여 넣으면 내 말투로 새 초안을 받습니다.' },
      { title: '채널마다 맞춤', body: '한 번 생성한 뒤 각 네트워크의 제한과 관례에 맞춰 조정하세요.' },
      { title: '내 데이터로 학습하지 않아요', body: '요청과 초안은 AI 모델 학습에 쓰이지 않습니다. 오직 내 워크스페이스를 위해서만 쓰여요.' },
    ],
  },
  faq: [
    { q: 'AI가 자동으로 게시하나요?', a: '절대 아니에요. AI는 초안을 쓰고 승인은 내가 합니다. 예약되기 전에 모든 단어가 내 손을 거치고, 게시는 더 말할 것도 없어요.' },
    { q: '내 콘텐츠가 AI 모델 학습에 쓰이나요?', a: '아니요. 요청과 초안은 모델 학습에 쓰이지 않습니다. 전체 내용은 개인정보 처리방침을 확인하세요.' },
    { q: '어떤 언어를 지원하나요?', a: '100개 이상입니다. 생성 전에 언어를 고르니 번역이 아니라 그 언어로 쓴 초안이 나와요.' },
    { q: '사실이 불확실하면 어떻게 되나요?', a: '작성 도우미가 알려 줍니다. 불확실한 점은 표시되고 출처가 연결되어 있어 게시 전에 확인할 수 있어요.' },
    { q: '아이디어 하나를 10개 채널 모두에 맞출 수 있나요?', a: '네. 한 번 생성한 뒤 각 네트워크의 제한과 관례에 맞춰 채널별로 조정하세요.' },
  ],
  ctaTitle: '내 아이디어를 글로, 사실 확인까지.',
  ctaBody: '대략적인 생각만 가져오세요. 첫 초안과 리서치는 어시스턴트가 하고, 모든 단어의 최종 결정은 내가 합니다.',
};

const zh: AiAssistantCopy = {
  metaTitle: '带实时调研的 AI 社交媒体写作助手',
  metaDesc: '以 100 多种语言起草文案和串文，基于带来源链接的实时网络调研，并用你的语气改写。未经你确认，不会发布任何内容。',
  kicker: 'AI 助手',
  title: '会核实事实的写作助手。',
  lede: '输入粗略的想法，得到可以直接发布的文案。基于带来源链接的实时调研，按你的风格撰写，支持 100 多种语言。未经你确认，不会发布任何内容。',
  seeComposer: '查看编辑器',
  heroCaption: 'AI 写作助手就在编辑器旁：输入想法，得到草稿，未经你确认不会发布。',
  crumbFeatures: '功能',
  how: {
    kicker: '工作方式',
    title: '从粗略想法到你批准的帖子。',
    lede: '助手负责起草，你来决定。每一步都清晰可见，在你亲自排期之前，任何内容都不会发到网络上。',
    steps: [
      { title: '从一个想法开始', body: '一句话、一个链接或一段零散笔记都可以。先选语言，再选语气和风格。' },
      { title: '它会调研', body: '开启调研后，它会在写作前阅读实时网络内容，并保留使用的来源。' },
      { title: '它会起草', body: '为你选择的每个渠道写出文案或完整串文，并标出不确定的说法。' },
      { title: '由你批准', body: '随意修改后再排期。助手可以起草，但永远不能发布。' },
    ],
  },
  research: {
    kicker: '调研',
    title: '有据可依，而非凭空猜测。',
    body: '开启调研后，写作助手会在起草前搜索实时网络，把文案连同使用的来源一起交给你，并标出不确定之处。追热点的帖子终于有了依据。',
    points: ['起草前进行实时网络调研', '每份草稿都附带来源', '不确定之处会被标出，而不是被掩盖'],
    caption: '语言、语气、风格、格式和结构，全部在生成前设定。',
  },
  writing: {
    kicker: '写作',
    title: '写出状态最好时的你。',
    lede: '带真实示例的风格、读起来自然的串文，以及保留你语气的改写。',
    items: [
      { title: '先选你的语言', body: '在生成任何内容前，从 100 多种语言中选择，草稿是原生撰写，而不是从英语翻译。' },
      { title: '风格卡片', body: '快讯、串文、深度拆解等，每种都附带实时示例。' },
      { title: '真正的串文', body: '长篇想法会变成多条帖子组成的串文，在读者会停顿的地方分段，绝不凑字数。' },
      { title: '随时改写', body: '粘贴一段草稿或已发布的帖子，得到一版保留你语气的新草稿。' },
      { title: '按渠道适配', body: '生成一次，再根据各网络的限制和惯例进行调整。' },
      { title: '绝不用你的数据训练', body: '你的指令和草稿不会用于训练 AI 模型，只服务于你的工作区。' },
    ],
  },
  faq: [
    { q: 'AI 会自动发布吗？', a: '绝不会。它负责起草，你负责批准。每个字在排期前都要经过你，更不用说发布了。' },
    { q: '我的内容会被用来训练 AI 模型吗？', a: '不会。你的指令和草稿不会用于训练模型。完整说明请查看隐私政策。' },
    { q: '支持哪些语言？', a: '一百多种。在生成前先选语言，所以草稿是原生撰写，而不是翻译。' },
    { q: '事实不确定时会怎样？', a: '写作助手会直接说明：不确定之处会被标出并附上来源链接，你可以在发布前核实。' },
    { q: '能把一个想法适配到全部十个渠道吗？', a: '可以。生成一次，再按各网络的限制和惯例逐个渠道调整。' },
  ],
  ctaTitle: '你的想法，写好并核实。',
  ctaBody: '带上粗略的想法。助手完成初稿和调研，每个字的最终决定权都在你手里。',
};

export const aiAssistantCopy: Record<Locale, AiAssistantCopy> = { en, es, fr, de, ja, ko, zh };
