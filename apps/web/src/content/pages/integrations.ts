import type { Locale } from '@/lib/i18n/locales';
import { CHANNEL_GUIDES } from '@/content/channels';

/**
 * /integrations copy in every locale (see content/pages/features.ts). The
 * cards' tagline and "best for" tags come from the English channel guides
 * (content/channels.ts); `channels` translates them per channel key, and a
 * key missing from a translation falls back to the guide's English.
 */

type ChannelCard = { tagline: string; bestFor: string[] };

const en = {
  metaTitle: 'Integrations for Instagram, TikTok, X and more',
  metaDesc:
    'Connect Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube, Pinterest, Bluesky, Mastodon, blogs and more. Schedule them all from one calendar.',
  eyebrow: 'Integrations',
  cardTitle: 'Every channel you use, in one calendar.',
  title: 'Sosial × every channel you use.',
  lede: 'Real API publishing, per-channel limits handled for you, and honest notes on what each network actually rewards.',
  dockLabel: 'Every channel',
  promises: [
    { title: 'Official APIs', body: 'Posts go out through each network’s real publishing API.' },
    { title: 'Limits handled', body: 'Character counts, media sizes and formats checked per channel.' },
    { title: 'One queue', body: 'Every channel shares the same calendar, retries and alerts.' },
  ],
  networks: '{n} networks, one calendar',
  characters: '{n} characters',
  guide: '{name} guide',
  channels: Object.fromEntries(
    CHANNEL_GUIDES.map((c) => [c.key, { tagline: c.tagline, bestFor: c.bestFor.slice(0, 3) }]),
  ) as Record<string, ChannelCard>,
};

export type IntegrationsCopy = typeof en;

const es: IntegrationsCopy = {
  metaTitle: 'Integraciones con Instagram, TikTok, X y más',
  metaDesc:
    'Conecta Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube, Pinterest, Bluesky, Mastodon, blogs y más. Prográmalos todos desde un calendario.',
  eyebrow: 'Integraciones',
  cardTitle: 'Cada canal que usas, en un calendario.',
  title: 'Sosial × cada canal que usas.',
  lede: 'Publicación con API reales, los límites de cada canal resueltos por ti y notas honestas sobre lo que de verdad premia cada red.',
  dockLabel: 'Todos los canales',
  promises: [
    { title: 'API oficiales', body: 'Las publicaciones salen por la API de publicación real de cada red.' },
    { title: 'Límites resueltos', body: 'Caracteres, tamaños de medios y formatos comprobados por canal.' },
    { title: 'Una sola cola', body: 'Todos los canales comparten el mismo calendario, reintentos y alertas.' },
  ],
  networks: '{n} redes, un calendario',
  characters: '{n} caracteres',
  guide: 'Guía de {name}',
  channels: {
    instagram: { tagline: 'Reels, carruseles e historias que premian los tres primeros segundos.', bestFor: ['Reels y vídeo vertical corto', 'Carruseles con una idea por diapositiva', 'Detrás de cámaras y primeros planos de producto'] },
    tiktok: { tagline: 'Vídeo vertical con aire nativo, programado sin abrir la app.', bestFor: ['Vídeo 9:16 de menos de 60 segundos', 'Clips de tendencias', 'Series educativas con un gancho recurrente'] },
    x: { tagline: 'Hilos que retienen la atención, escritos y programados de una vez.', bestFor: ['Hilos que construyen un argumento', 'Comentarios de actualidad', 'Novedades de producto y construir en público'] },
    facebook: { tagline: 'El límite de texto más amplio y la ventana de programación más flexible.', bestFor: ['Historias más largas', 'Preguntas a la comunidad', 'Anuncios de eventos y lanzamientos'] },
    threads: { tagline: 'Publicaciones conversacionales donde una respuesta puede llegar más lejos que el original.', bestFor: ['Opiniones y preguntas', 'Novedades de producto informales', 'Cadenas que continúan una idea'] },
    youtube: { tagline: 'Vídeos largos y Shorts desde la misma cola.', bestFor: ['Tutoriales y reseñas', 'Shorts a partir de clips verticales', 'Contenido atemporal que se busca'] },
    linkedin: { tagline: 'Las dos primeras líneas deciden si una publicación se lee.', bestFor: ['Lecciones y casos de estudio', 'Contratación y noticias de empresa', 'Análisis del sector'] },
    bluesky: { tagline: 'Publicaciones cortas y sinceras, con un feed en el que de verdad influyes.', bestFor: ['Opiniones breves', 'Público de desarrolladores e investigadores', 'Enlaces a trabajos extensos'] },
    mastodon: { tagline: 'Publicar pensando en la comunidad, con avisos de contenido bien hechos.', bestFor: ['Comunidades técnicas', 'Novedades de código abierto e investigación', 'Debates más extensos'] },
    pinterest: { tagline: 'Descubrimiento atemporal donde un pin sigue funcionando durante meses.', bestFor: ['Gráficos de cómo hacer', 'Imágenes de producto', 'Contenido de temporada y atemporal'] },
    telegram: { tagline: 'Canales y grupos que llegan a los suscriptores sin un algoritmo de por medio.', bestFor: ['Anuncios de producto y versiones', 'Novedades para la comunidad de un canal', 'Lanzamientos con fecha límite'] },
    discord: { tagline: 'Anuncios y novedades que llegan al canal correcto del servidor.', bestFor: ['Anuncios del servidor', 'Eventos y registros de cambios', 'Propuestas para animar a la comunidad'] },
    wordpress: { tagline: 'Envía entradas del calendario directamente a tu sitio autoalojado.', bestFor: ['Artículos largos', 'Contenido orientado al SEO', 'Publicación programada sin iniciar sesión'] },
    devto: { tagline: 'Artículos para desarrolladores, publicados donde los ingenieros de verdad leen.', bestFor: ['Tutoriales y análisis a fondo', 'Notas de versión de herramientas para desarrolladores', 'Artículos de opinión técnica'] },
    hashnode: { tagline: 'Publica en paralelo tus textos de ingeniería en tu propio blog de Hashnode.', bestFor: ['Blogs personales de ingeniería', 'Publicar en paralelo desde tu propio sitio', 'Escritura técnica impulsada por la comunidad'] },
    ghost: { tagline: 'Newsletters y entradas de blog publicadas desde el mismo calendario.', bestFor: ['Newsletters', 'Blogs para miembros', 'Publicación larga con envío por correo'] },
    vk: { tagline: 'Llega al público de habla rusa en la red que usa cada día.', bestFor: ['Público de habla rusa', 'Novedades para la comunidad', 'Publicaciones con enlaces y medios'] },
  },
};

const fr: IntegrationsCopy = {
  metaTitle: 'Intégrations Instagram, TikTok, X et plus',
  metaDesc:
    'Connectez Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube, Pinterest, Bluesky, Mastodon, des blogs et plus. Planifiez-les tous depuis un calendrier.',
  eyebrow: 'Intégrations',
  cardTitle: 'Tous vos canaux, dans un calendrier.',
  title: 'Sosial × tous vos canaux.',
  lede: 'Publication via les vraies API, limites de chaque canal gérées pour vous, et des notes honnêtes sur ce que chaque réseau valorise vraiment.',
  dockLabel: 'Tous les canaux',
  promises: [
    { title: 'API officielles', body: 'Les publications passent par la vraie API de publication de chaque réseau.' },
    { title: 'Limites gérées', body: 'Caractères, tailles de médias et formats vérifiés pour chaque canal.' },
    { title: 'Une seule file', body: 'Tous les canaux partagent le même calendrier, les mêmes relances et alertes.' },
  ],
  networks: '{n} réseaux, un calendrier',
  characters: '{n} caractères',
  guide: 'Guide {name}',
  channels: {
    instagram: { tagline: 'Reels, carrousels et stories qui se jouent dans les trois premières secondes.', bestFor: ['Reels et vidéo verticale courte', 'Carrousels avec une idée par slide', 'Coulisses et gros plans produit'] },
    tiktok: { tagline: 'De la vidéo verticale au ton natif, planifiée sans l’appli.', bestFor: ['Vidéo 9:16 de moins de 60 secondes', 'Clips portés par les tendances', 'Séries pédagogiques avec une accroche récurrente'] },
    x: { tagline: 'Des threads qui retiennent l’attention, écrits et planifiés d’un seul geste.', bestFor: ['Threads qui construisent un argument', 'Commentaires d’actualité', 'Nouveautés produit et build in public'] },
    facebook: { tagline: 'La plus grande limite de texte et la fenêtre de planification la plus souple.', bestFor: ['Récits plus longs', 'Questions à la communauté', 'Annonces d’événements et de lancements'] },
    threads: { tagline: 'Des publications conversationnelles où une réponse peut aller plus loin que l’original.', bestFor: ['Opinions et questions', 'Nouveautés produit sur un ton léger', 'Suites qui prolongent une idée'] },
    youtube: { tagline: 'Vidéos longues et Shorts depuis la même file.', bestFor: ['Tutoriels et tests', 'Shorts à partir de clips verticaux', 'Contenus intemporels portés par la recherche'] },
    linkedin: { tagline: 'Les deux premières lignes décident si une publication est lue.', bestFor: ['Leçons et études de cas', 'Recrutement et actualités d’entreprise', 'Analyses sectorielles'] },
    bluesky: { tagline: 'Des publications courtes et sincères, avec un fil que vous influencez vraiment.', bestFor: ['Avis courts', 'Publics de développeurs et de chercheurs', 'Liens vers des contenus longs'] },
    mastodon: { tagline: 'Publier en pensant communauté, avec des avertissements de contenu bien faits.', bestFor: ['Communautés techniques', 'Actualités open source et recherche', 'Discussions plus longues'] },
    pinterest: { tagline: 'Une découverte durable où une épingle travaille pendant des mois.', bestFor: ['Visuels pratiques', 'Images de produits', 'Contenus saisonniers et intemporels'] },
    telegram: { tagline: 'Des chaînes et groupes qui touchent les abonnés sans algorithme au milieu.', bestFor: ['Annonces de produits et de versions', 'Actualités pour la communauté d’une chaîne', 'Sorties à durée limitée'] },
    discord: { tagline: 'Des annonces et nouveautés qui arrivent dans le bon salon du serveur.', bestFor: ['Annonces du serveur', 'Événements et journaux des modifications', 'Invitations à faire réagir la communauté'] },
    wordpress: { tagline: 'Envoyez les articles du calendrier directement sur votre site auto-hébergé.', bestFor: ['Articles longs', 'Contenus pensés pour le SEO', 'Publication planifiée sans se connecter'] },
    devto: { tagline: 'Des articles pour développeurs, publiés là où les ingénieurs lisent vraiment.', bestFor: ['Tutoriels et analyses approfondies', 'Notes de version d’outils pour développeurs', 'Tribunes techniques'] },
    hashnode: { tagline: 'Republiez vos écrits techniques sur votre propre blog Hashnode.', bestFor: ['Blogs techniques personnels', 'Republication depuis votre propre site', 'Écriture technique portée par la communauté'] },
    ghost: { tagline: 'Newsletters et articles de blog publiés depuis le même calendrier.', bestFor: ['Newsletters', 'Blogs pour abonnés', 'Publication longue avec envoi par e-mail'] },
    vk: { tagline: 'Touchez les publics russophones sur le réseau qu’ils utilisent chaque jour.', bestFor: ['Publics russophones', 'Actualités pour la communauté', 'Publications avec liens et médias'] },
  },
};

const de: IntegrationsCopy = {
  metaTitle: 'Integrationen für Instagram, TikTok, X und mehr',
  metaDesc:
    'Verbinde Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube, Pinterest, Bluesky, Mastodon, Blogs und mehr. Plane alles aus einem Kalender.',
  eyebrow: 'Integrationen',
  cardTitle: 'Jeder Kanal, den du nutzt, in einem Kalender.',
  title: 'Sosial × jeder Kanal, den du nutzt.',
  lede: 'Veröffentlichen über echte APIs, Limits pro Kanal für dich geregelt und ehrliche Hinweise, was jedes Netzwerk wirklich belohnt.',
  dockLabel: 'Alle Kanäle',
  promises: [
    { title: 'Offizielle APIs', body: 'Beiträge gehen über die echte Veröffentlichungs-API jedes Netzwerks raus.' },
    { title: 'Limits geregelt', body: 'Zeichenzahl, Mediengrößen und Formate werden pro Kanal geprüft.' },
    { title: 'Eine Warteschlange', body: 'Alle Kanäle teilen sich Kalender, Wiederholungen und Warnungen.' },
  ],
  networks: '{n} Netzwerke, ein Kalender',
  characters: '{n} Zeichen',
  guide: '{name}-Leitfaden',
  channels: {
    instagram: { tagline: 'Reels, Karussells und Stories, bei denen die ersten drei Sekunden zählen.', bestFor: ['Reels und kurze Hochkantvideos', 'Karussells mit einer Idee pro Slide', 'Blicke hinter die Kulissen und Produktnahaufnahmen'] },
    tiktok: { tagline: 'Hochkantvideo, das sich nativ anfühlt, geplant ohne die App.', bestFor: ['9:16-Video unter 60 Sekunden', 'Trendgetriebene Clips', 'Lernreihen mit wiederkehrendem Aufhänger'] },
    x: { tagline: 'Threads, die fesseln, in einem Durchgang geschrieben und geplant.', bestFor: ['Threads, die ein Argument aufbauen', 'Aktuelle Kommentare', 'Produkt- und Build-in-Public-Updates'] },
    facebook: { tagline: 'Das großzügigste Textlimit und das nachsichtigste Planungsfenster.', bestFor: ['Längere Geschichten', 'Fragen an die Community', 'Event- und Launch-Ankündigungen'] },
    threads: { tagline: 'Gesprächige Beiträge, bei denen eine Antwort weiter reichen kann als das Original.', bestFor: ['Meinungen und Fragen', 'Lockere Produkt-Updates', 'Ketten, die einen Gedanken fortführen'] },
    youtube: { tagline: 'Lange Videos und Shorts aus derselben Warteschlange.', bestFor: ['Tutorials und Reviews', 'Shorts aus Hochkantclips', 'Zeitlose, suchgetriebene Inhalte'] },
    linkedin: { tagline: 'Die ersten zwei Zeilen entscheiden, ob ein Beitrag gelesen wird.', bestFor: ['Lehren und Fallstudien', 'Stellen und Unternehmensnews', 'Branchenanalysen'] },
    bluesky: { tagline: 'Kurze, ehrliche Beiträge mit einem Feed, den du wirklich beeinflussen kannst.', bestFor: ['Kurze Einschätzungen', 'Entwickler- und Forschungspublikum', 'Links zu längeren Arbeiten'] },
    mastodon: { tagline: 'Posten mit Community im Blick, mit richtig gemachten Inhaltswarnungen.', bestFor: ['Technische Communities', 'Open-Source- und Forschungsupdates', 'Längere Diskussionen'] },
    pinterest: { tagline: 'Zeitlose Entdeckung, bei der ein Pin monatelang wirkt.', bestFor: ['Anleitungsgrafiken', 'Produktbilder', 'Saisonale und zeitlose Inhalte'] },
    telegram: { tagline: 'Kanäle und Gruppen, die Abonnenten ohne Algorithmus dazwischen erreichen.', bestFor: ['Produkt- und Release-Ankündigungen', 'Community-Updates für einen Kanal', 'Zeitkritische Drops'] },
    discord: { tagline: 'Ankündigungen und Updates, die im richtigen Server-Kanal landen.', bestFor: ['Server-Ankündigungen', 'Events und Changelogs', 'Anstöße für die Community'] },
    wordpress: { tagline: 'Schick Beiträge aus dem Kalender direkt auf deine selbst gehostete Seite.', bestFor: ['Lange Artikel', 'SEO-getriebene Inhalte', 'Geplantes Veröffentlichen ohne Anmeldung'] },
    devto: { tagline: 'Artikel für Entwickler, veröffentlicht dort, wo Engineers wirklich lesen.', bestFor: ['Tutorials und Deep Dives', 'Release Notes für Entwicklertools', 'Technische Meinungsbeiträge'] },
    hashnode: { tagline: 'Technische Texte parallel in deinem eigenen Hashnode-Blog veröffentlichen.', bestFor: ['Persönliche Engineering-Blogs', 'Crossposting von der eigenen Website', 'Technisches Schreiben aus der Community'] },
    ghost: { tagline: 'Newsletter und Blogbeiträge aus demselben Kalender veröffentlicht.', bestFor: ['Newsletter', 'Mitglieder-Blogs', 'Lange Beiträge mit E-Mail-Versand'] },
    vk: { tagline: 'Erreiche russischsprachiges Publikum im Netzwerk, das es täglich nutzt.', bestFor: ['Russischsprachiges Publikum', 'Community-Updates', 'Beiträge mit Links und Medien'] },
  },
};

const ja: IntegrationsCopy = {
  metaTitle: 'Instagram、TikTok、Xなどとの連携',
  metaDesc:
    'Instagram、TikTok、X、Facebook、Threads、LinkedIn、YouTube、Pinterest、Bluesky、Mastodon、ブログなどを接続。すべて1つのカレンダーから予約できます。',
  eyebrow: '連携',
  cardTitle: '使っているすべてのチャネルを、1つのカレンダーに。',
  title: 'Sosial × あなたが使うすべてのチャネル。',
  lede: '公式APIによる投稿、チャネルごとの制限への自動対応、そして各ネットワークで本当に評価される投稿についての率直なメモ。',
  dockLabel: 'すべてのチャネル',
  promises: [
    { title: '公式API', body: '投稿は各ネットワークの正式な投稿APIを通じて公開されます。' },
    { title: '制限に対応', body: '文字数、メディアのサイズと形式をチャネルごとにチェック。' },
    { title: '1つのキュー', body: 'すべてのチャネルが同じカレンダー、再試行、通知を共有します。' },
  ],
  networks: '{n}のネットワーク、1つのカレンダー',
  characters: '{n}文字',
  guide: '{name}ガイド',
  channels: {
    instagram: { tagline: '最初の3秒が勝負のリール、カルーセル、ストーリーズ。', bestFor: ['リールと短い縦型動画', '1枚に1つのアイデアを伝えるカルーセル', '舞台裏と商品のクローズアップ'] },
    tiktok: { tagline: 'アプリを開かずに予約できる、ネイティブ感のある縦型動画。', bestFor: ['60秒未満の9:16動画', 'トレンドに乗ったクリップ', '毎回同じフックで始まる解説シリーズ'] },
    x: { tagline: '注目を集め続けるスレッドを、一度に書いて予約。', bestFor: ['論点を積み上げるスレッド', 'タイムリーなコメント', 'プロダクトの更新や開発の公開'] },
    facebook: { tagline: '最も長い文字数制限と、最も融通の利く予約時間帯。', bestFor: ['長めのストーリー投稿', 'コミュニティへの質問', 'イベントやローンチの告知'] },
    threads: { tagline: '返信が元の投稿より広がることもある、会話型の投稿。', bestFor: ['意見と質問', '気軽なプロダクトの更新', '考えを続けるつながった投稿'] },
    youtube: { tagline: '長尺動画もショートも同じキューから。', bestFor: ['チュートリアルとレビュー', '縦型クリップから作るショート', '検索で見つかる定番コンテンツ'] },
    linkedin: { tagline: '最初の2行で、読まれるかどうかが決まる。', bestFor: ['学びと事例紹介', '採用と会社のニュース', '業界分析'] },
    bluesky: { tagline: '短く率直な投稿と、自分で左右できるフィード。', bestFor: ['短い意見', '開発者や研究者向け', '長文コンテンツへのリンク'] },
    mastodon: { tagline: 'コミュニティを大切にした投稿と、きちんとした閲覧注意の設定。', bestFor: ['技術コミュニティ', 'オープンソースや研究の更新情報', '長めの議論'] },
    pinterest: { tagline: 'ピンが何か月も働き続ける、息の長い発見の場。', bestFor: ['ハウツー画像', '商品画像', '季節もの・定番のコンテンツ'] },
    telegram: { tagline: 'アルゴリズムを挟まずに購読者へ届くチャンネルとグループ。', bestFor: ['製品やリリースの告知', 'チャンネル向けのコミュニティ更新', '期間限定の告知'] },
    discord: { tagline: 'お知らせや更新を、サーバーの適切なチャンネルへ。', bestFor: ['サーバーのお知らせ', 'イベントと更新履歴', 'コミュニティの交流を促す投稿'] },
    wordpress: { tagline: 'カレンダーから自分でホストするサイトへ、記事を直接公開。', bestFor: ['長文記事', 'SEO向けのコンテンツ', 'ログイン不要の予約公開'] },
    devto: { tagline: 'エンジニアが実際に読む場所に、開発者向け記事を公開。', bestFor: ['チュートリアルと詳しい解説', '開発者向けツールのリリースノート', '技術的なオピニオン記事'] },
    hashnode: { tagline: '技術記事を自分のHashnodeブログにも同時公開。', bestFor: ['個人のエンジニアリングブログ', '自分のサイトからの同時投稿', 'コミュニティ発の技術記事'] },
    ghost: { tagline: 'ニュースレターとブログ記事を同じカレンダーから公開。', bestFor: ['ニュースレター', '会員向けブログ', 'メール配信付きの長文公開'] },
    vk: { tagline: 'ロシア語圏のユーザーに、毎日使うネットワークで届ける。', bestFor: ['ロシア語圏のオーディエンス', 'コミュニティの更新', 'リンクやメディアの投稿'] },
  },
};

const ko: IntegrationsCopy = {
  metaTitle: 'Instagram, TikTok, X 등과의 연동',
  metaDesc:
    'Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube, Pinterest, Bluesky, Mastodon, 블로그 등을 연결하세요. 모두 캘린더 하나에서 예약합니다.',
  eyebrow: '연동',
  cardTitle: '쓰는 모든 채널을 캘린더 하나에.',
  title: 'Sosial × 내가 쓰는 모든 채널.',
  lede: '공식 API로 게시하고, 채널별 제한은 알아서 처리하며, 각 네트워크가 실제로 좋아하는 콘텐츠를 솔직하게 정리했습니다.',
  dockLabel: '모든 채널',
  promises: [
    { title: '공식 API', body: '게시물은 각 네트워크의 실제 게시 API를 통해 나갑니다.' },
    { title: '제한 자동 처리', body: '글자 수, 미디어 크기와 형식을 채널마다 확인합니다.' },
    { title: '대기열 하나', body: '모든 채널이 같은 캘린더, 재시도, 알림을 공유합니다.' },
  ],
  networks: '네트워크 {n}개, 캘린더 하나',
  characters: '{n}자',
  guide: '{name} 가이드',
  channels: {
    instagram: { tagline: '첫 3초가 승부인 릴스, 캐러셀, 스토리.', bestFor: ['릴스와 짧은 세로 영상', '슬라이드마다 아이디어 하나를 담은 캐러셀', '비하인드와 제품 클로즈업'] },
    tiktok: { tagline: '앱 없이 예약하는, 자연스러운 세로 영상.', bestFor: ['60초 미만의 9:16 영상', '트렌드를 탄 클립', '반복되는 훅이 있는 교육 시리즈'] },
    x: { tagline: '관심을 붙잡는 스레드를 한 번에 쓰고 예약하세요.', bestFor: ['논리를 쌓아 가는 스레드', '시의성 있는 코멘트', '제품 소식과 빌드 인 퍼블릭'] },
    facebook: { tagline: '가장 넉넉한 글자 수 제한과 가장 여유로운 예약 시간대.', bestFor: ['긴 스토리 게시물', '커뮤니티 질문', '이벤트와 출시 공지'] },
    threads: { tagline: '답글이 원글보다 멀리 퍼질 수 있는 대화형 게시물.', bestFor: ['의견과 질문', '가벼운 제품 소식', '생각을 이어 가는 연속 게시물'] },
    youtube: { tagline: '긴 영상과 쇼츠를 같은 대기열에서.', bestFor: ['튜토리얼과 리뷰', '세로 클립으로 만든 쇼츠', '검색으로 오래 찾는 콘텐츠'] },
    linkedin: { tagline: '첫 두 줄이 게시물이 읽힐지를 결정합니다.', bestFor: ['교훈과 사례 연구', '채용과 회사 소식', '업계 분석'] },
    bluesky: { tagline: '짧고 솔직한 게시물, 그리고 직접 영향을 줄 수 있는 피드.', bestFor: ['짧은 의견', '개발자와 연구자 대상', '긴 글로 연결하는 링크'] },
    mastodon: { tagline: '커뮤니티를 먼저 생각하는 게시, 제대로 된 콘텐츠 경고.', bestFor: ['기술 커뮤니티', '오픈소스와 연구 소식', '긴 토론'] },
    pinterest: { tagline: '핀 하나가 몇 달 동안 일하는 오래가는 발견의 공간.', bestFor: ['하우투 그래픽', '제품 이미지', '시즌성·상시 콘텐츠'] },
    telegram: { tagline: '알고리즘 없이 구독자에게 바로 닿는 채널과 그룹.', bestFor: ['제품과 릴리스 공지', '채널 커뮤니티 소식', '기간 한정 공개'] },
    discord: { tagline: '공지와 소식을 서버의 알맞은 채널로.', bestFor: ['서버 공지', '이벤트와 변경 내역', '커뮤니티 참여 유도'] },
    wordpress: { tagline: '캘린더에서 직접 호스팅하는 사이트로 글을 바로 게시하세요.', bestFor: ['긴 글', 'SEO 중심 콘텐츠', '로그인 없이 예약 게시'] },
    devto: { tagline: '엔지니어가 실제로 읽는 곳에 개발자 글을 게시하세요.', bestFor: ['튜토리얼과 심층 분석', '개발자 도구 릴리스 노트', '기술 칼럼'] },
    hashnode: { tagline: '엔지니어링 글을 내 Hashnode 블로그에도 함께 게시하세요.', bestFor: ['개인 엔지니어링 블로그', '내 사이트 글 교차 게시', '커뮤니티 기반 기술 글쓰기'] },
    ghost: { tagline: '뉴스레터와 블로그 글을 같은 캘린더에서 게시하세요.', bestFor: ['뉴스레터', '멤버십 블로그', '이메일 발송이 포함된 긴 글'] },
    vk: { tagline: '러시아어권 사용자가 매일 쓰는 네트워크에서 만나세요.', bestFor: ['러시아어권 오디언스', '커뮤니티 소식', '링크와 미디어 게시물'] },
  },
};

const zh: IntegrationsCopy = {
  metaTitle: 'Instagram、TikTok、X 等平台集成',
  metaDesc: '连接 Instagram、TikTok、X、Facebook、Threads、LinkedIn、YouTube、Pinterest、Bluesky、Mastodon、博客等，在一个日历中统一排期。',
  eyebrow: '集成',
  cardTitle: '你用的每个渠道，都在一个日历里。',
  title: 'Sosial × 你用的每个渠道。',
  lede: '通过真实 API 发布，各渠道限制自动处理，并如实说明每个网络真正青睐的内容。',
  dockLabel: '所有渠道',
  promises: [
    { title: '官方 API', body: '帖子通过各网络真正的发布 API 发出。' },
    { title: '限制自动处理', body: '按渠道检查字数、媒体大小和格式。' },
    { title: '一个队列', body: '所有渠道共用同一个日历、重试和提醒。' },
  ],
  networks: '{n} 个网络，一个日历',
  characters: '{n} 个字符',
  guide: '{name} 指南',
  channels: {
    instagram: { tagline: '前三秒决定成败的 Reels、轮播和快拍。', bestFor: ['Reels 和竖版短视频', '每页讲一个要点的轮播', '幕后花絮和产品特写'] },
    tiktok: { tagline: '原生感十足的竖版视频，无需打开应用即可排期。', bestFor: ['60 秒以内的 9:16 视频', '紧跟潮流的短片', '有固定开场钩子的教学系列'] },
    x: { tagline: '抓住注意力的串文，一次写好并排期。', bestFor: ['层层推进观点的串文', '时效性评论', '产品动态和公开构建'] },
    facebook: { tagline: '最宽松的字数限制，最灵活的排期窗口。', bestFor: ['较长的故事型帖子', '社区提问', '活动和发布公告'] },
    threads: { tagline: '对话式帖子，一条回复的传播可能超过原帖。', bestFor: ['观点和提问', '轻松的产品动态', '延续想法的连续帖子'] },
    youtube: { tagline: '长视频和 Shorts 来自同一个队列。', bestFor: ['教程和测评', '用竖版片段制作的 Shorts', '靠搜索长期带来流量的内容'] },
    linkedin: { tagline: '前两行决定帖子会不会被阅读。', bestFor: ['经验和案例研究', '招聘和公司新闻', '行业分析'] },
    bluesky: { tagline: '简短真诚的帖子，以及你真正能影响的信息流。', bestFor: ['简短观点', '开发者和研究人员受众', '指向长文的链接'] },
    mastodon: { tagline: '以社区为先的发布方式，内容警告也做得到位。', bestFor: ['技术社区', '开源和研究动态', '较长的讨论'] },
    pinterest: { tagline: '长期有效的发现平台，一个 Pin 能持续发挥作用数月。', bestFor: ['教程类图片', '产品图片', '季节性和常青内容'] },
    telegram: { tagline: '频道和群组直达订阅者，没有算法从中阻隔。', bestFor: ['产品和版本发布公告', '频道社区动态', '限时发布'] },
    discord: { tagline: '公告和动态准确送达服务器的对应频道。', bestFor: ['服务器公告', '活动和更新日志', '激发社区互动的话题'] },
    wordpress: { tagline: '从日历直接把文章推送到你自托管的网站。', bestFor: ['长篇文章', '以 SEO 为导向的内容', '无需登录的定时发布'] },
    devto: { tagline: '开发者文章，发布在工程师真正阅读的地方。', bestFor: ['教程和深度解析', '开发者工具的版本说明', '技术观点文章'] },
    hashnode: { tagline: '把工程类文章同步发布到你自己的 Hashnode 博客。', bestFor: ['个人工程博客', '从自己网站同步发布', '社区驱动的技术写作'] },
    ghost: { tagline: '在同一个日历中发布电子报和博客文章。', bestFor: ['电子报', '会员博客', '带邮件推送的长文发布'] },
    vk: { tagline: '在俄语用户每天使用的网络上触达他们。', bestFor: ['俄语受众', '社区动态', '链接和媒体帖子'] },
  },
};

export const integrationsCopy: Record<Locale, IntegrationsCopy> = { en, es, fr, de, ja, ko, zh };
