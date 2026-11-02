import type { Locale } from '@/lib/i18n/locales';

/** /features/create copy in every locale (see content/pages/features.ts). */

const en = {
  metaTitle: 'Social media post composer with live previews',
  metaDesc:
    'Write one post for every network with per-channel previews, real character limits, templates, photos, video and AI cover images.',
  kicker: 'Create',
  title: 'Start from a blank page less.',
  lede: 'One composer writes for every network at once, with live previews, honest character counts, reusable templates and media that fits everywhere.',
  meetAi: 'Meet the AI writer',
  heroCaption: 'Create post: pick channels, write once, post now or schedule.',
  crumbFeatures: 'Features',
  composer: {
    kicker: 'Composer',
    title: 'Write once, preview everywhere.',
    body: 'Pick your channels and the composer shows each one the way it will actually appear, with a live counter against its real limit. No surprises after you hit schedule.',
    points: [
      'Per-channel preview cards before anything ships',
      'Live counters against true platform limits',
      'Over-long captions trim before scheduling, not after',
    ],
    caption: 'Quick post on the dashboard, for text that ships right now.',
  },
  kit: {
    kicker: 'Everything in the composer',
    title: 'Templates, media and covers, without leaving the post.',
    lede: 'The pieces you reach for every day sit inside the composer, so a post goes from idea to scheduled in one place.',
    items: [
      {
        title: 'Templates',
        body: 'Save any post as a template and reuse the structure next time. Your best formats become the starting point.',
      },
      {
        title: 'Reuse what worked',
        body: 'Saved captions and full designs are there when you start the next post, so you never build the same one twice.',
      },
      {
        title: 'Photos and video',
        body: 'Attach up to four images or a video to any post. Each channel gets media in the shape it expects.',
      },
      {
        title: 'Topical photos',
        body: 'Pull a real photo matched to your topic when the camera roll has nothing that fits.',
      },
      {
        title: 'AI cover images',
        body: 'Describe the cover you want and generate it from a prompt, right beside the caption.',
      },
      {
        title: 'Honest counters',
        body: 'Every channel counts against its own real limit, and over-long captions trim before they ship.',
      },
    ],
  },
  faq: [
    {
      q: 'Do I have to rewrite my caption for each channel?',
      a: 'No. You write once; the composer adapts with per-channel previews and counters, and trims where a limit demands it.',
    },
    {
      q: 'Which media types can I attach?',
      a: 'Up to four images or a video per post, plus topical photos and AI-generated covers. Each channel page lists exactly what its network accepts.',
    },
    {
      q: 'Can I edit a post after scheduling it?',
      a: 'Yes. Edit the caption, swap media or move the slot any time before it ships.',
    },
    {
      q: 'What templates are included?',
      a: 'Save any caption or full design as a template and reuse it any time. Your own saved templates from posts that performed are always there.',
    },
  ],
};

export type CreateCopy = typeof en;

const es: CreateCopy = {
  metaTitle: 'Editor de publicaciones para redes sociales con vista previa',
  metaDesc:
    'Escribe una publicación para todas las redes con vista previa por canal, límites reales de caracteres, plantillas, fotos, vídeo y portadas con IA.',
  kicker: 'Crear',
  title: 'Menos veces frente a una página en blanco.',
  lede: 'Un solo editor escribe para todas las redes a la vez, con vistas previas en vivo, contadores de caracteres fiables, plantillas reutilizables y medios que encajan en todas partes.',
  meetAi: 'Conoce el redactor con IA',
  heroCaption: 'Crear publicación: elige canales, escribe una vez, publica ya o programa.',
  crumbFeatures: 'Funciones',
  composer: {
    kicker: 'Editor',
    title: 'Escribe una vez, previsualiza en todas partes.',
    body: 'Elige tus canales y el editor muestra cada uno tal como se verá, con un contador en vivo frente a su límite real. Sin sorpresas después de programar.',
    points: [
      'Tarjetas de vista previa por canal antes de publicar',
      'Contadores en vivo frente a los límites reales de cada plataforma',
      'Los textos demasiado largos se recortan antes de programar, no después',
    ],
    caption: 'Publicación rápida en el panel, para textos que salen al momento.',
  },
  kit: {
    kicker: 'Todo dentro del editor',
    title: 'Plantillas, medios y portadas sin salir de la publicación.',
    lede: 'Lo que usas cada día está dentro del editor, así que una publicación pasa de idea a programada en un solo lugar.',
    items: [
      {
        title: 'Plantillas',
        body: 'Guarda cualquier publicación como plantilla y reutiliza su estructura. Tus mejores formatos se convierten en el punto de partida.',
      },
      {
        title: 'Reutiliza lo que funcionó',
        body: 'Los textos y diseños guardados te esperan al empezar la siguiente publicación, para no crear lo mismo dos veces.',
      },
      {
        title: 'Fotos y vídeo',
        body: 'Adjunta hasta cuatro imágenes o un vídeo a cualquier publicación. Cada canal recibe los medios en el formato que espera.',
      },
      {
        title: 'Fotos temáticas',
        body: 'Trae una foto real que encaje con tu tema cuando tu galería no tiene nada adecuado.',
      },
      {
        title: 'Portadas con IA',
        body: 'Describe la portada que quieres y génerala a partir de una instrucción, junto al texto.',
      },
      {
        title: 'Contadores fiables',
        body: 'Cada canal cuenta contra su propio límite real, y los textos demasiado largos se recortan antes de salir.',
      },
    ],
  },
  faq: [
    {
      q: '¿Tengo que reescribir el texto para cada canal?',
      a: 'No. Escribes una vez; el editor se adapta con vistas previas y contadores por canal, y recorta cuando un límite lo exige.',
    },
    {
      q: '¿Qué tipos de medios puedo adjuntar?',
      a: 'Hasta cuatro imágenes o un vídeo por publicación, además de fotos temáticas y portadas generadas con IA. La página de cada canal indica exactamente qué acepta esa red.',
    },
    {
      q: '¿Puedo editar una publicación después de programarla?',
      a: 'Sí. Edita el texto, cambia los medios o mueve la hora en cualquier momento antes de que salga.',
    },
    {
      q: '¿Qué plantillas incluye?',
      a: 'Guarda cualquier texto o diseño completo como plantilla y reutilízalo cuando quieras. Tus plantillas de publicaciones que funcionaron siempre están ahí.',
    },
  ],
};

const fr: CreateCopy = {
  metaTitle: 'Éditeur de publications pour réseaux sociaux avec aperçus',
  metaDesc:
    'Écrivez une publication pour chaque réseau avec aperçus par canal, vraies limites de caractères, modèles, photos, vidéo et couvertures générées par IA.',
  kicker: 'Créer',
  title: 'Moins souvent face à la page blanche.',
  lede: 'Un seul éditeur écrit pour tous les réseaux à la fois, avec aperçus en direct, compteurs de caractères fiables, modèles réutilisables et médias adaptés partout.',
  meetAi: 'Découvrir le rédacteur IA',
  heroCaption: 'Créer une publication : choisissez les canaux, écrivez une fois, publiez ou planifiez.',
  crumbFeatures: 'Fonctionnalités',
  composer: {
    kicker: 'Éditeur',
    title: 'Écrivez une fois, prévisualisez partout.',
    body: 'Choisissez vos canaux et l’éditeur affiche chacun tel qu’il apparaîtra, avec un compteur en direct sur sa vraie limite. Aucune surprise après la planification.',
    points: [
      'Aperçus par canal avant toute publication',
      'Compteurs en direct sur les vraies limites des plateformes',
      'Les légendes trop longues sont raccourcies avant la planification, pas après',
    ],
    caption: 'Publication rapide sur le tableau de bord, pour un texte qui part tout de suite.',
  },
  kit: {
    kicker: 'Tout dans l’éditeur',
    title: 'Modèles, médias et couvertures sans quitter la publication.',
    lede: 'Ce dont vous vous servez chaque jour se trouve dans l’éditeur : une publication passe de l’idée à la planification au même endroit.',
    items: [
      {
        title: 'Modèles',
        body: 'Enregistrez n’importe quelle publication comme modèle et réutilisez sa structure. Vos meilleurs formats deviennent le point de départ.',
      },
      {
        title: 'Réutilisez ce qui marche',
        body: 'Légendes et visuels enregistrés vous attendent à la publication suivante : vous ne refaites jamais deux fois la même chose.',
      },
      {
        title: 'Photos et vidéo',
        body: 'Joignez jusqu’à quatre images ou une vidéo à chaque publication. Chaque canal reçoit les médias au format attendu.',
      },
      {
        title: 'Photos thématiques',
        body: 'Récupérez une vraie photo adaptée à votre sujet quand votre pellicule n’a rien qui convienne.',
      },
      {
        title: 'Couvertures par IA',
        body: 'Décrivez la couverture voulue et générez-la à partir d’une consigne, juste à côté de la légende.',
      },
      {
        title: 'Compteurs fiables',
        body: 'Chaque canal compte selon sa vraie limite, et les légendes trop longues sont raccourcies avant de partir.',
      },
    ],
  },
  faq: [
    {
      q: 'Dois-je réécrire ma légende pour chaque canal ?',
      a: 'Non. Vous écrivez une fois ; l’éditeur s’adapte avec aperçus et compteurs par canal, et raccourcit là où une limite l’exige.',
    },
    {
      q: 'Quels types de médias puis-je joindre ?',
      a: 'Jusqu’à quatre images ou une vidéo par publication, plus des photos thématiques et des couvertures générées par IA. La page de chaque canal indique précisément ce que le réseau accepte.',
    },
    {
      q: 'Puis-je modifier une publication après l’avoir planifiée ?',
      a: 'Oui. Modifiez la légende, changez les médias ou déplacez l’horaire à tout moment avant le départ.',
    },
    {
      q: 'Quels modèles sont inclus ?',
      a: 'Enregistrez n’importe quelle légende ou visuel complet comme modèle et réutilisez-le quand vous voulez. Vos modèles issus des publications qui ont marché sont toujours là.',
    },
  ],
};

const de: CreateCopy = {
  metaTitle: 'Social-Media-Editor mit Live-Vorschau',
  metaDesc:
    'Schreib einen Beitrag für jedes Netzwerk, mit Vorschau pro Kanal, echten Zeichenlimits, Vorlagen, Fotos, Video und KI-Titelbildern.',
  kicker: 'Erstellen',
  title: 'Seltener vor dem leeren Blatt.',
  lede: 'Ein Editor schreibt für alle Netzwerke gleichzeitig, mit Live-Vorschau, ehrlichen Zeichenzählern, wiederverwendbaren Vorlagen und Medien, die überall passen.',
  meetAi: 'Den KI-Texter kennenlernen',
  heroCaption: 'Beitrag erstellen: Kanäle wählen, einmal schreiben, sofort posten oder planen.',
  crumbFeatures: 'Funktionen',
  composer: {
    kicker: 'Editor',
    title: 'Einmal schreiben, überall voransehen.',
    body: 'Wähl deine Kanäle und der Editor zeigt jeden so, wie er tatsächlich erscheint, mit einem Live-Zähler gegen sein echtes Limit. Keine Überraschungen nach dem Planen.',
    points: [
      'Vorschaukarten pro Kanal, bevor etwas rausgeht',
      'Live-Zähler gegen die echten Plattformlimits',
      'Zu lange Texte werden vor dem Planen gekürzt, nicht danach',
    ],
    caption: 'Schnellbeitrag im Dashboard, für Text, der sofort rausgeht.',
  },
  kit: {
    kicker: 'Alles im Editor',
    title: 'Vorlagen, Medien und Titelbilder, ohne den Beitrag zu verlassen.',
    lede: 'Was du täglich brauchst, liegt im Editor. So geht ein Beitrag an einem Ort von der Idee bis zur Planung.',
    items: [
      {
        title: 'Vorlagen',
        body: 'Speichere jeden Beitrag als Vorlage und nutze den Aufbau wieder. Deine besten Formate werden zum Ausgangspunkt.',
      },
      {
        title: 'Wiederverwenden, was funktioniert',
        body: 'Gespeicherte Texte und komplette Designs warten beim nächsten Beitrag, damit du nichts doppelt baust.',
      },
      {
        title: 'Fotos und Video',
        body: 'Hänge bis zu vier Bilder oder ein Video an jeden Beitrag. Jeder Kanal bekommt die Medien im passenden Format.',
      },
      {
        title: 'Passende Fotos',
        body: 'Hol dir ein echtes Foto zu deinem Thema, wenn die Galerie nichts Passendes hat.',
      },
      {
        title: 'KI-Titelbilder',
        body: 'Beschreib das gewünschte Titelbild und erzeuge es per Prompt, direkt neben dem Text.',
      },
      {
        title: 'Ehrliche Zähler',
        body: 'Jeder Kanal zählt gegen sein eigenes echtes Limit, und zu lange Texte werden vor der Veröffentlichung gekürzt.',
      },
    ],
  },
  faq: [
    {
      q: 'Muss ich meinen Text für jeden Kanal neu schreiben?',
      a: 'Nein. Du schreibst einmal; der Editor passt sich mit Vorschauen und Zählern pro Kanal an und kürzt, wo ein Limit es verlangt.',
    },
    {
      q: 'Welche Medien kann ich anhängen?',
      a: 'Bis zu vier Bilder oder ein Video pro Beitrag, dazu passende Fotos und KI-generierte Titelbilder. Jede Kanalseite listet genau, was das Netzwerk akzeptiert.',
    },
    {
      q: 'Kann ich einen Beitrag nach dem Planen bearbeiten?',
      a: 'Ja. Text ändern, Medien tauschen oder Termin verschieben, jederzeit vor der Veröffentlichung.',
    },
    {
      q: 'Welche Vorlagen sind enthalten?',
      a: 'Speichere jeden Text oder jedes komplette Design als Vorlage und nutze es jederzeit wieder. Deine Vorlagen aus erfolgreichen Beiträgen sind immer da.',
    },
  ],
};

const ja: CreateCopy = {
  metaTitle: 'プレビュー付きSNS投稿エディター',
  metaDesc:
    'すべてのネットワーク向けの投稿を1つで作成。チャネル別プレビュー、実際の文字数制限、テンプレート、写真、動画、AIカバー画像に対応。',
  kicker: '作成',
  title: '白紙から始める回数を減らす。',
  lede: '1つのエディターですべてのネットワーク向けに同時に書けます。リアルタイムのプレビュー、正確な文字数カウント、再利用できるテンプレート、どこにでも合うメディア。',
  meetAi: 'AIライターを見る',
  heroCaption: '投稿作成：チャネルを選び、一度書いて、今すぐ投稿または予約。',
  crumbFeatures: '機能',
  composer: {
    kicker: 'エディター',
    title: '一度書けば、すべてをプレビュー。',
    body: 'チャネルを選ぶと、実際の表示どおりのプレビューと、実際の制限に対するリアルタイムのカウントが表示されます。予約後に驚くことはありません。',
    points: [
      '公開前にチャネルごとのプレビューカード',
      '実際のプラットフォーム制限に対するリアルタイムカウント',
      '長すぎるキャプションは予約前に短縮',
    ],
    caption: 'ダッシュボードのクイック投稿。すぐに出したいテキストに。',
  },
  kit: {
    kicker: 'エディターにすべてそろう',
    title: 'テンプレート、メディア、カバーを投稿画面のまま。',
    lede: '毎日使うものはエディターの中にあるので、アイデアから予約まで1か所で完結します。',
    items: [
      {
        title: 'テンプレート',
        body: 'どの投稿もテンプレートとして保存し、次回はその構成を再利用。うまくいった形式が出発点になります。',
      },
      {
        title: 'うまくいったものを再利用',
        body: '保存したキャプションやデザインは次の投稿ですぐ使えるので、同じものを二度作る必要はありません。',
      },
      {
        title: '写真と動画',
        body: '各投稿に最大4枚の画像または1本の動画を添付。各チャネルに合った形でメディアを届けます。',
      },
      {
        title: 'テーマに合った写真',
        body: 'カメラロールに合う写真がないときは、トピックに合った実写写真を取り込めます。',
      },
      {
        title: 'AIカバー画像',
        body: '欲しいカバーを説明すれば、キャプションのすぐ横でプロンプトから生成できます。',
      },
      {
        title: '正確なカウント',
        body: '各チャネルを実際の制限でカウントし、長すぎるキャプションは公開前に短縮します。',
      },
    ],
  },
  faq: [
    {
      q: 'チャネルごとにキャプションを書き直す必要がありますか？',
      a: 'いいえ。書くのは一度だけ。エディターがチャネル別のプレビューとカウントで調整し、制限に合わせて短縮します。',
    },
    {
      q: 'どんなメディアを添付できますか？',
      a: '1投稿につき最大4枚の画像または1本の動画に加え、テーマに合った写真やAI生成のカバーも使えます。各チャネルのページに、そのネットワークが受け付ける内容を正確に記載しています。',
    },
    {
      q: '予約後に投稿を編集できますか？',
      a: 'はい。公開されるまでは、キャプションの編集、メディアの差し替え、時刻の変更がいつでもできます。',
    },
    {
      q: 'どんなテンプレートがありますか？',
      a: 'どのキャプションやデザインもテンプレートとして保存し、いつでも再利用できます。成果の出た投稿から作ったテンプレートはいつでも使えます。',
    },
  ],
};

const ko: CreateCopy = {
  metaTitle: '실시간 미리 보기가 있는 소셜 미디어 게시물 작성기',
  metaDesc:
    '채널별 미리 보기, 실제 글자 수 제한, 템플릿, 사진, 동영상, AI 커버 이미지로 모든 네트워크용 게시물을 한 번에 작성하세요.',
  kicker: '만들기',
  title: '빈 페이지 앞에 앉는 일을 줄이세요.',
  lede: '작성기 하나로 모든 네트워크용 글을 동시에 씁니다. 실시간 미리 보기, 정확한 글자 수, 다시 쓰는 템플릿, 어디에나 맞는 미디어까지.',
  meetAi: 'AI 작성 도우미 보기',
  heroCaption: '게시물 만들기: 채널을 고르고 한 번 쓴 뒤 바로 게시하거나 예약하세요.',
  crumbFeatures: '기능',
  composer: {
    kicker: '작성기',
    title: '한 번 쓰고, 어디서나 미리 보기.',
    body: '채널을 고르면 작성기가 각 채널에 실제로 보일 모습과 실제 제한에 맞춘 실시간 글자 수를 보여줍니다. 예약한 뒤에 놀랄 일은 없어요.',
    points: [
      '게시 전 채널별 미리 보기 카드',
      '실제 플랫폼 제한에 맞춘 실시간 글자 수',
      '너무 긴 캡션은 예약 전에 줄여요',
    ],
    caption: '대시보드의 빠른 게시. 지금 바로 올릴 글에.',
  },
  kit: {
    kicker: '작성기 안에 모두',
    title: '게시물을 떠나지 않고 템플릿, 미디어, 커버까지.',
    lede: '매일 쓰는 도구가 작성기 안에 있어 아이디어부터 예약까지 한곳에서 끝납니다.',
    items: [
      {
        title: '템플릿',
        body: '어떤 게시물이든 템플릿으로 저장하고 구성을 다시 쓰세요. 가장 좋았던 형식이 출발점이 됩니다.',
      },
      {
        title: '잘된 것을 다시',
        body: '저장한 캡션과 디자인이 다음 게시물을 시작할 때 준비되어 있어 같은 걸 두 번 만들 필요가 없어요.',
      },
      {
        title: '사진과 동영상',
        body: '게시물마다 이미지 최대 4장 또는 동영상 1개를 첨부하세요. 각 채널에 맞는 형태로 전달됩니다.',
      },
      {
        title: '주제에 맞는 사진',
        body: '갤러리에 맞는 사진이 없을 때 주제에 어울리는 실제 사진을 가져오세요.',
      },
      {
        title: 'AI 커버 이미지',
        body: '원하는 커버를 설명하면 캡션 바로 옆에서 프롬프트로 생성합니다.',
      },
      {
        title: '정확한 글자 수',
        body: '채널마다 실제 제한으로 세고, 너무 긴 캡션은 게시 전에 줄입니다.',
      },
    ],
  },
  faq: [
    {
      q: '채널마다 캡션을 다시 써야 하나요?',
      a: '아니요. 한 번만 쓰면 작성기가 채널별 미리 보기와 글자 수로 맞추고, 제한이 있으면 줄여 줍니다.',
    },
    {
      q: '어떤 미디어를 첨부할 수 있나요?',
      a: '게시물당 이미지 최대 4장 또는 동영상 1개, 그리고 주제에 맞는 사진과 AI 생성 커버를 쓸 수 있어요. 각 채널 페이지에 해당 네트워크가 받는 형식이 정확히 나와 있습니다.',
    },
    {
      q: '예약한 뒤에도 게시물을 수정할 수 있나요?',
      a: '네. 게시되기 전이라면 언제든 캡션 수정, 미디어 교체, 시간 변경이 가능합니다.',
    },
    {
      q: '어떤 템플릿이 들어 있나요?',
      a: '어떤 캡션이나 디자인이든 템플릿으로 저장해 언제든 다시 쓸 수 있어요. 성과가 좋았던 게시물로 만든 템플릿은 항상 그 자리에 있습니다.',
    },
  ],
};

const zh: CreateCopy = {
  metaTitle: '带实时预览的社交媒体帖子编辑器',
  metaDesc: '为每个网络撰写同一条帖子：按渠道预览、真实字数限制、模板、图片、视频和 AI 封面图。',
  kicker: '创作',
  title: '少面对几次空白页。',
  lede: '一个编辑器同时为所有网络撰写内容，提供实时预览、准确的字数统计、可复用的模板，以及处处合适的媒体。',
  meetAi: '了解 AI 写作助手',
  heroCaption: '创建帖子：选择渠道，写一次，立即发布或排期。',
  crumbFeatures: '功能',
  composer: {
    kicker: '编辑器',
    title: '写一次，处处预览。',
    body: '选择渠道后，编辑器会按真实效果展示每个渠道，并按真实限制实时计数。排期之后不会有意外。',
    points: ['发布前按渠道显示预览卡片', '按平台真实限制实时计数', '过长的文案在排期前就会截短'],
    caption: '仪表盘中的快速发布，适合马上要发的文字。',
  },
  kit: {
    kicker: '编辑器里应有尽有',
    title: '模板、媒体和封面，无需离开帖子。',
    lede: '每天要用的工具都在编辑器里，帖子从想法到排期在同一个地方完成。',
    items: [
      { title: '模板', body: '把任何帖子存为模板，下次复用它的结构。你最好的格式会成为新的起点。' },
      { title: '复用有效内容', body: '已保存的文案和完整设计会在开始下一条帖子时等着你，不必重复制作。' },
      { title: '图片和视频', body: '每条帖子最多附加四张图片或一个视频。每个渠道都会收到它期望的媒体格式。' },
      { title: '主题图片', body: '相册里没有合适的图片时，可以获取一张与主题匹配的真实照片。' },
      { title: 'AI 封面图', body: '描述你想要的封面，在文案旁边直接用提示词生成。' },
      { title: '准确计数', body: '每个渠道按各自的真实限制计数，过长的文案在发布前截短。' },
    ],
  },
  faq: [
    {
      q: '需要为每个渠道重写文案吗？',
      a: '不需要。你只写一次，编辑器会通过按渠道的预览和计数进行适配，并在限制要求时截短。',
    },
    {
      q: '可以附加哪些媒体？',
      a: '每条帖子最多四张图片或一个视频，还可以使用主题图片和 AI 生成的封面。每个渠道页面都列出了该网络接受的确切格式。',
    },
    {
      q: '排期后还能编辑帖子吗？',
      a: '可以。在发布之前，随时可以修改文案、更换媒体或调整时间。',
    },
    {
      q: '包含哪些模板？',
      a: '任何文案或完整设计都可以存为模板并随时复用。你从表现好的帖子中保存的模板始终都在。',
    },
  ],
};

export const createCopy: Record<Locale, CreateCopy> = { en, es, fr, de, ja, ko, zh };
