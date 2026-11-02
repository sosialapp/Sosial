import type { Locale } from '@/lib/i18n/locales';

/** /publish copy in every locale (see content/pages/features.ts). */

const en = {
  metaTitle: 'Social media scheduling and auto-publishing',
  metaDesc:
    'Schedule posts to every network from one calendar and queue. Sosial publishes each channel on time, with live character limits and per-channel results.',
  kicker: 'Publish',
  title: 'Every post, on time, everywhere.',
  lede: 'Write once, drop it on the calendar, and let the queue ship every channel. No retyping per network, no 11pm manual posting.',
  seeChannels: 'See every channel',
  heroCaption: 'The Sosial calendar, month view. Drag a post to another day to move it.',
  crumbFeatures: 'Features',
  stats: [
    { value: '~1 min', label: 'From the scheduled slot to published, on every channel.' },
    { value: '0', label: 'Devices that need to stay on. The queue runs in the cloud.' },
    { value: '1', label: 'Calendar for every network you post to.' },
    { value: '280', label: 'Characters on X, 63,206 on Facebook. Each real limit, checked.' },
  ],
  calendar: {
    kicker: 'Calendar',
    title: 'One calendar for every channel.',
    body: 'Drafts, the queue and approvals live on the same grid. Drag a post between days and every channel target moves with it. Nothing to re-enter, nothing to forget.',
    points: [
      'See the whole week across every network at a glance',
      'Drafts sit beside scheduled posts until you commit them',
      'Approvals show exactly where they are in the flow',
    ],
    caption: 'List view: the next two weeks, day by day.',
  },
  queue: {
    kicker: 'Queue',
    title: 'A queue that runs itself.',
    body: 'Schedule a post and the cloud worker publishes each channel within about a minute of its slot, even with the app closed and the laptop shut. Per-channel results land back in the queue, so you always know what went out.',
    points: [
      'Post now or schedule for later in the same composer',
      'Pause, edit or pull anything before its slot',
      'Every channel reports back: sent, publishing or failed',
    ],
    caption: 'The dashboard week: every queued post, by day.',
  },
  control: {
    kicker: 'Control',
    title: 'Mistakes caught before they ship.',
    lede: 'Limits, edits and outages are handled in the composer and the queue, not discovered on the network afterwards.',
    items: [
      {
        title: 'Limits, checked as you type',
        body: '280 on X, 500 on Threads, 2,200 on Instagram and TikTok. Counters run against the strictest channel you pick.',
      },
      {
        title: 'Change your mind freely',
        body: 'Edit the caption, swap the image, move the slot or pull the post, right up to the minute it ships.',
      },
      {
        title: 'Disconnects pause, not fail',
        body: 'Queued posts for a disconnected channel wait. Reconnect and they carry on, nothing lost.',
      },
      {
        title: 'One result per channel',
        body: 'If a network is down at your slot, only that channel fails. Fix it and re-queue just that one.',
      },
    ],
  },
  faq: [
    {
      q: 'Do I need my phone nearby for posts to go out?',
      a: 'No. Publishing runs on the cloud worker, not your device. Schedule from anywhere and close the app. Posts still ship on time.',
    },
    {
      q: 'Can I publish immediately instead of scheduling?',
      a: 'Yes. Post now and schedule later live in the same composer with the same channels, previews and results.',
    },
    {
      q: 'What happens if a platform is down at my slot?',
      a: 'That channel reports failed in the queue while the rest go out normally. Fix the connection and re-queue just the failed channel.',
    },
    {
      q: 'What happens if I disconnect a channel with posts queued?',
      a: 'Its queued items pause instead of failing. Reconnect and they resume. Nothing is lost.',
    },
    {
      q: 'How fast does publishing happen?',
      a: 'The worker ships every channel inside about a minute of the scheduled time, and each result lands back in the queue.',
    },
  ],
};

export type PublishCopy = typeof en;

const es: PublishCopy = {
  metaTitle: 'Programación y publicación automática en redes sociales',
  metaDesc:
    'Programa publicaciones en todas las redes desde un calendario y una cola. Sosial publica cada canal a tiempo, con límites de caracteres en vivo y resultados por canal.',
  kicker: 'Publicar',
  title: 'Cada publicación, a tiempo, en todas partes.',
  lede: 'Escribe una vez, colócala en el calendario y deja que la cola publique en cada canal. Sin reescribir para cada red ni publicar a mano a las 11 de la noche.',
  seeChannels: 'Ver todos los canales',
  heroCaption: 'El calendario de Sosial en vista mensual. Arrastra una publicación a otro día para moverla.',
  crumbFeatures: 'Funciones',
  stats: [
    { value: '~1 min', label: 'Desde la hora programada hasta publicada, en cada canal.' },
    { value: '0', label: 'Dispositivos que deben quedarse encendidos. La cola funciona en la nube.' },
    { value: '1', label: 'Calendario para todas las redes en las que publicas.' },
    { value: '280', label: 'Caracteres en X, 63.206 en Facebook. Cada límite real, comprobado.' },
  ],
  calendar: {
    kicker: 'Calendario',
    title: 'Un calendario para todos los canales.',
    body: 'Borradores, cola y aprobaciones viven en la misma cuadrícula. Arrastra una publicación entre días y todos sus canales se mueven con ella. Nada que volver a escribir, nada que olvidar.',
    points: [
      'Ve toda la semana de todas las redes de un vistazo',
      'Los borradores quedan junto a las publicaciones programadas hasta que los confirmes',
      'Las aprobaciones muestran exactamente en qué punto están',
    ],
    caption: 'Vista de lista: las próximas dos semanas, día a día.',
  },
  queue: {
    kicker: 'Cola',
    title: 'Una cola que funciona sola.',
    body: 'Programa una publicación y el servicio en la nube publica cada canal en torno a un minuto de su hora, incluso con la app cerrada y el portátil apagado. Los resultados de cada canal vuelven a la cola, así que siempre sabes qué salió.',
    points: [
      'Publica ya o programa para más tarde en el mismo editor',
      'Pausa, edita o retira cualquier cosa antes de su hora',
      'Cada canal informa: enviada, publicándose o fallida',
    ],
    caption: 'La semana del panel: cada publicación en cola, por día.',
  },
  control: {
    kicker: 'Control',
    title: 'Los errores se detectan antes de publicar.',
    lede: 'Los límites, las ediciones y las caídas se resuelven en el editor y en la cola, no se descubren después en la red.',
    items: [
      {
        title: 'Límites comprobados mientras escribes',
        body: '280 en X, 500 en Threads, 2.200 en Instagram y TikTok. Los contadores se miden contra el canal más estricto que elijas.',
      },
      {
        title: 'Cambia de opinión cuando quieras',
        body: 'Edita el texto, cambia la imagen, mueve la hora o retira la publicación hasta el minuto en que sale.',
      },
      {
        title: 'Una desconexión pausa, no falla',
        body: 'Las publicaciones en cola de un canal desconectado esperan. Vuelve a conectarlo y continúan, sin perder nada.',
      },
      {
        title: 'Un resultado por canal',
        body: 'Si una red está caída a tu hora, solo falla ese canal. Arréglalo y vuelve a poner en cola solo ese.',
      },
    ],
  },
  faq: [
    {
      q: '¿Necesito tener el móvil cerca para que salgan las publicaciones?',
      a: 'No. La publicación se ejecuta en la nube, no en tu dispositivo. Programa desde donde quieras y cierra la app. Las publicaciones salen a tiempo igualmente.',
    },
    {
      q: '¿Puedo publicar al momento en lugar de programar?',
      a: 'Sí. Publicar ahora y programar para después están en el mismo editor, con los mismos canales, vistas previas y resultados.',
    },
    {
      q: '¿Qué pasa si una plataforma está caída a mi hora?',
      a: 'Ese canal aparece como fallido en la cola mientras el resto sale con normalidad. Arregla la conexión y vuelve a poner en cola solo el canal que falló.',
    },
    {
      q: '¿Qué pasa si desconecto un canal con publicaciones en cola?',
      a: 'Sus elementos en cola se pausan en lugar de fallar. Vuelve a conectarlo y se reanudan. No se pierde nada.',
    },
    {
      q: '¿Qué tan rápido se publica?',
      a: 'El servicio publica cada canal en torno a un minuto de la hora programada, y cada resultado vuelve a la cola.',
    },
  ],
};

const fr: PublishCopy = {
  metaTitle: 'Planification et publication automatique sur les réseaux sociaux',
  metaDesc:
    'Planifiez vos publications sur chaque réseau depuis un calendrier et une file. Sosial publie chaque canal à l’heure, avec limites de caractères en direct et résultats par canal.',
  kicker: 'Publier',
  title: 'Chaque publication, à l’heure, partout.',
  lede: 'Écrivez une fois, placez-la dans le calendrier et laissez la file publier sur chaque canal. Plus de réécriture par réseau, plus de publication manuelle à 23 h.',
  seeChannels: 'Voir tous les canaux',
  heroCaption: 'Le calendrier Sosial en vue mois. Faites glisser une publication vers un autre jour pour la déplacer.',
  crumbFeatures: 'Fonctionnalités',
  stats: [
    { value: '~1 min', label: 'Entre l’heure prévue et la publication, sur chaque canal.' },
    { value: '0', label: 'Appareil qui doit rester allumé. La file tourne dans le cloud.' },
    { value: '1', label: 'Calendrier pour tous les réseaux où vous publiez.' },
    { value: '280', label: 'Caractères sur X, 63 206 sur Facebook. Chaque vraie limite, vérifiée.' },
  ],
  calendar: {
    kicker: 'Calendrier',
    title: 'Un calendrier pour tous les canaux.',
    body: 'Brouillons, file et validations partagent la même grille. Faites glisser une publication d’un jour à l’autre et tous ses canaux suivent. Rien à ressaisir, rien à oublier.',
    points: [
      'Toute la semaine de chaque réseau en un coup d’œil',
      'Les brouillons restent à côté des publications planifiées jusqu’à validation',
      'Les validations montrent précisément où elles en sont',
    ],
    caption: 'Vue liste : les deux prochaines semaines, jour par jour.',
  },
  queue: {
    kicker: 'File',
    title: 'Une file qui tourne toute seule.',
    body: 'Planifiez une publication et le service cloud publie chaque canal environ une minute après l’heure prévue, même application fermée et ordinateur éteint. Les résultats de chaque canal reviennent dans la file : vous savez toujours ce qui est parti.',
    points: [
      'Publiez maintenant ou plus tard depuis le même éditeur',
      'Mettez en pause, modifiez ou retirez avant l’heure prévue',
      'Chaque canal rend compte : envoyé, en cours ou échoué',
    ],
    caption: 'La semaine du tableau de bord : chaque publication en file, par jour.',
  },
  control: {
    kicker: 'Contrôle',
    title: 'Les erreurs repérées avant de partir.',
    lede: 'Limites, modifications et pannes sont gérées dans l’éditeur et la file, pas découvertes après coup sur le réseau.',
    items: [
      {
        title: 'Limites vérifiées pendant la saisie',
        body: '280 sur X, 500 sur Threads, 2 200 sur Instagram et TikTok. Les compteurs suivent le canal le plus strict que vous choisissez.',
      },
      {
        title: 'Changez d’avis librement',
        body: 'Modifiez la légende, changez l’image, déplacez l’horaire ou retirez la publication jusqu’à la minute où elle part.',
      },
      {
        title: 'Une déconnexion met en pause',
        body: 'Les publications en file d’un canal déconnecté attendent. Reconnectez-le et elles reprennent, sans rien perdre.',
      },
      {
        title: 'Un résultat par canal',
        body: 'Si un réseau est en panne à votre horaire, seul ce canal échoue. Corrigez-le et remettez uniquement celui-ci en file.',
      },
    ],
  },
  faq: [
    {
      q: 'Mon téléphone doit-il être à proximité pour que les publications partent ?',
      a: 'Non. La publication tourne dans le cloud, pas sur votre appareil. Planifiez depuis n’importe où et fermez l’application : les publications partent à l’heure.',
    },
    {
      q: 'Puis-je publier immédiatement au lieu de planifier ?',
      a: 'Oui. Publier maintenant et planifier se font dans le même éditeur, avec les mêmes canaux, aperçus et résultats.',
    },
    {
      q: 'Que se passe-t-il si une plateforme est en panne à mon horaire ?',
      a: 'Ce canal apparaît en échec dans la file pendant que les autres partent normalement. Réparez la connexion et remettez uniquement ce canal en file.',
    },
    {
      q: 'Que se passe-t-il si je déconnecte un canal avec des publications en file ?',
      a: 'Ses éléments en file sont mis en pause au lieu d’échouer. Reconnectez-le et ils reprennent. Rien n’est perdu.',
    },
    {
      q: 'La publication est-elle rapide ?',
      a: 'Le service publie chaque canal environ une minute après l’heure prévue, et chaque résultat revient dans la file.',
    },
  ],
};

const de: PublishCopy = {
  metaTitle: 'Social-Media-Planung und automatisches Veröffentlichen',
  metaDesc:
    'Plane Beiträge für jedes Netzwerk aus einem Kalender und einer Warteschlange. Sosial veröffentlicht jeden Kanal pünktlich, mit Live-Zeichenlimits und Ergebnissen pro Kanal.',
  kicker: 'Veröffentlichen',
  title: 'Jeder Beitrag, pünktlich, überall.',
  lede: 'Einmal schreiben, in den Kalender legen und die Warteschlange jeden Kanal bedienen lassen. Kein Abtippen pro Netzwerk, kein Posten von Hand um 23 Uhr.',
  seeChannels: 'Alle Kanäle ansehen',
  heroCaption: 'Der Sosial-Kalender in der Monatsansicht. Zieh einen Beitrag auf einen anderen Tag, um ihn zu verschieben.',
  crumbFeatures: 'Funktionen',
  stats: [
    { value: '~1 Min.', label: 'Vom geplanten Zeitpunkt bis zur Veröffentlichung, auf jedem Kanal.' },
    { value: '0', label: 'Geräte, die eingeschaltet bleiben müssen. Die Warteschlange läuft in der Cloud.' },
    { value: '1', label: 'Kalender für jedes Netzwerk, auf dem du postest.' },
    { value: '280', label: 'Zeichen auf X, 63.206 auf Facebook. Jedes echte Limit wird geprüft.' },
  ],
  calendar: {
    kicker: 'Kalender',
    title: 'Ein Kalender für jeden Kanal.',
    body: 'Entwürfe, Warteschlange und Freigaben liegen im selben Raster. Zieh einen Beitrag auf einen anderen Tag und jeder Kanal zieht mit. Nichts neu eingeben, nichts vergessen.',
    points: [
      'Die ganze Woche über alle Netzwerke auf einen Blick',
      'Entwürfe stehen neben geplanten Beiträgen, bis du sie bestätigst',
      'Freigaben zeigen genau, wo sie im Ablauf stehen',
    ],
    caption: 'Listenansicht: die nächsten zwei Wochen, Tag für Tag.',
  },
  queue: {
    kicker: 'Warteschlange',
    title: 'Eine Warteschlange, die von selbst läuft.',
    body: 'Plane einen Beitrag und der Cloud-Dienst veröffentlicht jeden Kanal etwa eine Minute nach dem Termin, auch wenn die App geschlossen und der Laptop zu ist. Die Ergebnisse pro Kanal landen wieder in der Warteschlange, damit du immer weißt, was raus ist.',
    points: [
      'Sofort posten oder später planen im selben Editor',
      'Vor dem Termin pausieren, bearbeiten oder zurückziehen',
      'Jeder Kanal meldet zurück: gesendet, wird veröffentlicht oder fehlgeschlagen',
    ],
    caption: 'Die Woche im Dashboard: jeder geplante Beitrag, nach Tag.',
  },
  control: {
    kicker: 'Kontrolle',
    title: 'Fehler werden vorher erkannt.',
    lede: 'Limits, Änderungen und Ausfälle werden im Editor und in der Warteschlange gelöst, nicht erst danach im Netzwerk entdeckt.',
    items: [
      {
        title: 'Limits beim Tippen geprüft',
        body: '280 auf X, 500 auf Threads, 2.200 auf Instagram und TikTok. Die Zähler richten sich nach dem strengsten gewählten Kanal.',
      },
      {
        title: 'Jederzeit umentscheiden',
        body: 'Text ändern, Bild tauschen, Termin verschieben oder Beitrag zurückziehen, bis zur Minute der Veröffentlichung.',
      },
      {
        title: 'Getrennte Kanäle pausieren',
        body: 'Geplante Beiträge eines getrennten Kanals warten. Verbinde ihn neu und sie laufen weiter, nichts geht verloren.',
      },
      {
        title: 'Ein Ergebnis pro Kanal',
        body: 'Ist ein Netzwerk zu deinem Termin ausgefallen, schlägt nur dieser Kanal fehl. Behebe es und plane nur diesen neu ein.',
      },
    ],
  },
  faq: [
    {
      q: 'Muss mein Handy in der Nähe sein, damit Beiträge rausgehen?',
      a: 'Nein. Veröffentlicht wird in der Cloud, nicht auf deinem Gerät. Plane von überall und schließ die App. Die Beiträge gehen trotzdem pünktlich raus.',
    },
    {
      q: 'Kann ich sofort veröffentlichen statt zu planen?',
      a: 'Ja. Sofort posten und später planen liegen im selben Editor, mit denselben Kanälen, Vorschauen und Ergebnissen.',
    },
    {
      q: 'Was passiert, wenn eine Plattform zu meinem Termin ausfällt?',
      a: 'Dieser Kanal meldet in der Warteschlange einen Fehler, die anderen gehen normal raus. Repariere die Verbindung und plane nur den fehlgeschlagenen Kanal neu ein.',
    },
    {
      q: 'Was passiert, wenn ich einen Kanal mit geplanten Beiträgen trenne?',
      a: 'Seine geplanten Einträge pausieren, statt fehlzuschlagen. Verbinde ihn neu und sie laufen weiter. Nichts geht verloren.',
    },
    {
      q: 'Wie schnell wird veröffentlicht?',
      a: 'Der Dienst bedient jeden Kanal etwa eine Minute nach dem geplanten Zeitpunkt, und jedes Ergebnis landet wieder in der Warteschlange.',
    },
  ],
};

const ja: PublishCopy = {
  metaTitle: 'SNSの予約投稿と自動公開',
  metaDesc:
    '1つのカレンダーとキューから、すべてのネットワークへの投稿を予約。Sosialはチャネルごとに時間どおりに公開し、文字数制限のリアルタイム確認とチャネル別の結果を提供します。',
  kicker: '投稿',
  title: 'すべての投稿を、時間どおりに、どこへでも。',
  lede: '一度書いてカレンダーに置けば、キューがすべてのチャネルに公開します。ネットワークごとの書き直しも、夜11時の手動投稿も不要です。',
  seeChannels: '対応チャネルを見る',
  heroCaption: 'Sosialカレンダーの月表示。投稿を別の日にドラッグすると移動できます。',
  crumbFeatures: '機能',
  stats: [
    { value: '約1分', label: '予約時刻から公開まで、すべてのチャネルで。' },
    { value: '0', label: '電源を入れておく必要のある端末。キューはクラウドで動きます。' },
    { value: '1', label: '投稿するすべてのネットワークのためのカレンダー。' },
    { value: '280', label: 'Xは280文字、Facebookは63,206文字。実際の制限をすべて確認。' },
  ],
  calendar: {
    kicker: 'カレンダー',
    title: 'すべてのチャネルを1つのカレンダーで。',
    body: '下書き、キュー、承認が同じグリッドに並びます。投稿を別の日にドラッグすれば、すべてのチャネルの予定も一緒に移動。入力し直しも、忘れ物もありません。',
    points: [
      'すべてのネットワークの1週間をひと目で確認',
      '確定するまで、下書きは予約投稿の横に並ぶ',
      '承認がどの段階にあるかが一目でわかる',
    ],
    caption: 'リスト表示：今後2週間を1日ずつ。',
  },
  queue: {
    kicker: 'キュー',
    title: '自動で動くキュー。',
    body: '投稿を予約すると、アプリを閉じていてもノートPCの電源が切れていても、クラウドの処理が予約時刻から約1分以内に各チャネルへ公開します。チャネルごとの結果はキューに戻るので、何が公開されたか常にわかります。',
    points: [
      '同じエディターで今すぐ投稿も予約もできる',
      '予約時刻までは一時停止、編集、取り下げが自由',
      '各チャネルが結果を報告：送信済み、公開中、失敗',
    ],
    caption: 'ダッシュボードの週表示：キュー内の投稿を日ごとに。',
  },
  control: {
    kicker: 'コントロール',
    title: 'ミスは公開前に見つかる。',
    lede: '文字数制限、編集、障害はエディターとキューで処理されます。公開後にネットワーク上で気づくことはありません。',
    items: [
      {
        title: '入力中に制限をチェック',
        body: 'Xは280、Threadsは500、InstagramとTikTokは2,200文字。選んだ中で最も厳しいチャネルに合わせてカウントします。',
      },
      {
        title: 'いつでも変更できる',
        body: 'キャプションの編集、画像の差し替え、時刻の変更、投稿の取り下げが、公開の直前までできます。',
      },
      {
        title: '接続が切れても失敗しない',
        body: '接続が切れたチャネルの予約投稿は待機します。再接続すれば再開し、何も失われません。',
      },
      {
        title: 'チャネルごとに結果',
        body: '予約時刻にネットワークが落ちていても、失敗するのはそのチャネルだけ。修正してそのチャネルだけ再予約できます。',
      },
    ],
  },
  faq: [
    {
      q: '投稿を公開するために、スマホを近くに置いておく必要はありますか？',
      a: 'いいえ。公開はお使いの端末ではなくクラウドで行われます。どこからでも予約して、アプリを閉じて大丈夫です。投稿は時間どおりに公開されます。',
    },
    {
      q: '予約せずにすぐ公開できますか？',
      a: 'はい。今すぐ投稿と予約投稿は同じエディターにあり、チャネル、プレビュー、結果も共通です。',
    },
    {
      q: '予約時刻にプラットフォームが停止していたらどうなりますか？',
      a: 'そのチャネルだけがキューで失敗と表示され、他のチャネルは通常どおり公開されます。接続を直して、失敗したチャネルだけ再予約してください。',
    },
    {
      q: '予約投稿があるチャネルの接続を解除したらどうなりますか？',
      a: 'キュー内の投稿は失敗せずに一時停止します。再接続すれば再開し、何も失われません。',
    },
    {
      q: '公開までの速さは？',
      a: '予約時刻から約1分以内にすべてのチャネルへ公開し、それぞれの結果がキューに戻ります。',
    },
  ],
};

const ko: PublishCopy = {
  metaTitle: '소셜 미디어 예약 및 자동 게시',
  metaDesc:
    '캘린더와 대기열 하나로 모든 네트워크에 게시물을 예약하세요. Sosial은 각 채널에 제시간에 게시하고, 실시간 글자 수 제한과 채널별 결과를 보여줍니다.',
  kicker: '게시',
  title: '모든 게시물을, 제시간에, 어디에나.',
  lede: '한 번 쓰고 캘린더에 올려두면 대기열이 모든 채널에 게시합니다. 네트워크마다 다시 쓸 필요도, 밤 11시에 직접 올릴 필요도 없어요.',
  seeChannels: '모든 채널 보기',
  heroCaption: 'Sosial 캘린더 월간 보기. 게시물을 다른 날로 끌어 옮길 수 있어요.',
  crumbFeatures: '기능',
  stats: [
    { value: '약 1분', label: '예약 시간부터 게시까지, 모든 채널에서.' },
    { value: '0', label: '켜 두어야 하는 기기 수. 대기열은 클라우드에서 돌아갑니다.' },
    { value: '1', label: '게시하는 모든 네트워크를 위한 캘린더 하나.' },
    { value: '280', label: 'X는 280자, Facebook은 63,206자. 실제 제한을 모두 확인합니다.' },
  ],
  calendar: {
    kicker: '캘린더',
    title: '모든 채널을 위한 캘린더 하나.',
    body: '초안, 대기열, 승인이 같은 그리드에 있습니다. 게시물을 다른 날로 끌면 모든 채널 일정이 함께 이동해요. 다시 입력할 것도, 잊어버릴 것도 없습니다.',
    points: [
      '모든 네트워크의 한 주를 한눈에',
      '확정하기 전까지 초안은 예약 게시물 옆에',
      '승인이 어느 단계에 있는지 정확히 표시',
    ],
    caption: '목록 보기: 앞으로 2주를 하루씩.',
  },
  queue: {
    kicker: '대기열',
    title: '알아서 돌아가는 대기열.',
    body: '게시물을 예약하면 앱을 닫고 노트북을 꺼도 클라우드가 예약 시간 약 1분 안에 각 채널에 게시합니다. 채널별 결과가 대기열로 돌아오니 무엇이 나갔는지 항상 알 수 있어요.',
    points: [
      '같은 작성기에서 지금 게시하거나 나중으로 예약',
      '예약 시간 전까지 일시 중지, 수정, 취소 가능',
      '채널마다 결과 보고: 전송됨, 게시 중, 실패',
    ],
    caption: '대시보드 주간 보기: 대기 중인 모든 게시물을 날짜별로.',
  },
  control: {
    kicker: '관리',
    title: '게시 전에 실수를 잡아냅니다.',
    lede: '제한, 수정, 장애는 작성기와 대기열에서 처리됩니다. 게시한 뒤에야 네트워크에서 발견하는 일은 없어요.',
    items: [
      {
        title: '입력하는 동안 제한 확인',
        body: 'X는 280자, Threads는 500자, Instagram과 TikTok은 2,200자. 고른 채널 중 가장 엄격한 기준으로 셉니다.',
      },
      {
        title: '언제든 마음을 바꾸세요',
        body: '게시되기 직전까지 캡션 수정, 이미지 교체, 시간 변경, 게시 취소가 가능합니다.',
      },
      {
        title: '연결이 끊겨도 실패하지 않아요',
        body: '연결이 끊긴 채널의 예약 게시물은 기다립니다. 다시 연결하면 이어서 진행되고, 잃는 것은 없습니다.',
      },
      {
        title: '채널마다 결과 하나',
        body: '예약 시간에 네트워크가 멈춰 있으면 그 채널만 실패합니다. 고친 뒤 그 채널만 다시 예약하세요.',
      },
    ],
  },
  faq: [
    {
      q: '게시물이 나가려면 휴대폰이 가까이 있어야 하나요?',
      a: '아니요. 게시는 기기가 아니라 클라우드에서 이루어집니다. 어디서든 예약하고 앱을 닫으세요. 게시물은 제시간에 나갑니다.',
    },
    {
      q: '예약하지 않고 바로 게시할 수 있나요?',
      a: '네. 지금 게시와 나중에 예약은 같은 작성기에 있고, 채널·미리 보기·결과도 같습니다.',
    },
    {
      q: '예약 시간에 플랫폼이 멈춰 있으면 어떻게 되나요?',
      a: '그 채널만 대기열에서 실패로 표시되고 나머지는 정상적으로 게시됩니다. 연결을 고친 뒤 실패한 채널만 다시 예약하세요.',
    },
    {
      q: '예약 게시물이 있는 채널의 연결을 끊으면 어떻게 되나요?',
      a: '대기 중인 항목은 실패하지 않고 일시 중지됩니다. 다시 연결하면 재개되며, 잃는 것은 없습니다.',
    },
    {
      q: '게시는 얼마나 빠른가요?',
      a: '예약 시간 약 1분 안에 모든 채널에 게시하고, 각 결과가 대기열로 돌아옵니다.',
    },
  ],
};

const zh: PublishCopy = {
  metaTitle: '社交媒体排期与自动发布',
  metaDesc: '用一个日历和队列为每个网络排期发帖。Sosial 准时发布到每个渠道，实时检查字数限制，并按渠道反馈结果。',
  kicker: '发布',
  title: '每条帖子，准时发往每个地方。',
  lede: '写一次，放进日历，让队列发布到每个渠道。不必为每个网络重写，也不必深夜 11 点手动发帖。',
  seeChannels: '查看所有渠道',
  heroCaption: 'Sosial 日历月视图。把帖子拖到另一天即可移动。',
  crumbFeatures: '功能',
  stats: [
    { value: '约 1 分钟', label: '从排期时间到发布完成，每个渠道都是如此。' },
    { value: '0', label: '台需要保持开机的设备。队列在云端运行。' },
    { value: '1', label: '个日历，管理你发布的所有网络。' },
    { value: '280', label: 'X 上 280 个字符，Facebook 上 63,206 个。每个真实限制都会检查。' },
  ],
  calendar: {
    kicker: '日历',
    title: '一个日历，管理所有渠道。',
    body: '草稿、队列和审批都在同一张网格里。把帖子拖到另一天，所有渠道目标一起移动。无需重新输入，也不会遗漏。',
    points: ['一眼看清所有网络的一整周', '草稿与已排期帖子并排，直到你确认', '清楚显示审批进行到哪一步'],
    caption: '列表视图：接下来两周，按天排列。',
  },
  queue: {
    kicker: '队列',
    title: '自动运转的队列。',
    body: '排期后，即使关闭应用、合上笔记本，云端服务也会在排期时间约一分钟内发布到每个渠道。每个渠道的结果会回到队列，你始终知道发出了什么。',
    points: ['在同一个编辑器里立即发布或稍后排期', '排期时间前可暂停、编辑或撤回', '每个渠道都会反馈：已发送、发布中或失败'],
    caption: '仪表盘中的一周：按天显示队列中的每条帖子。',
  },
  control: {
    kicker: '掌控',
    title: '错误在发布前就被发现。',
    lede: '字数限制、修改和故障都在编辑器和队列中处理，而不是发布后才在网络上发现。',
    items: [
      {
        title: '输入时即检查限制',
        body: 'X 为 280，Threads 为 500，Instagram 和 TikTok 为 2,200。计数器按你所选最严格的渠道计算。',
      },
      {
        title: '随时改主意',
        body: '直到发布前一分钟，都可以修改文案、更换图片、调整时间或撤回帖子。',
      },
      {
        title: '断开连接只会暂停',
        body: '已断开渠道的排期帖子会等待。重新连接后继续发布，什么都不会丢。',
      },
      {
        title: '每个渠道一个结果',
        body: '如果排期时某个网络宕机，只有该渠道失败。修复后只需重新排期这一个渠道。',
      },
    ],
  },
  faq: [
    {
      q: '帖子发布时需要手机在身边吗？',
      a: '不需要。发布在云端运行，而不是在你的设备上。随时随地排期后关闭应用，帖子依然会准时发出。',
    },
    {
      q: '可以立即发布而不排期吗？',
      a: '可以。立即发布和稍后排期在同一个编辑器里，渠道、预览和结果都一样。',
    },
    {
      q: '如果排期时平台宕机会怎样？',
      a: '该渠道会在队列中显示失败，其他渠道正常发布。修复连接后，只需重新排期失败的渠道。',
    },
    {
      q: '如果断开一个还有排期帖子的渠道会怎样？',
      a: '它的排期内容会暂停而不是失败。重新连接后继续发布，什么都不会丢。',
    },
    {
      q: '发布有多快？',
      a: '服务会在排期时间约一分钟内发布到每个渠道，每个结果都会回到队列。',
    },
  ],
};

export const publishCopy: Record<Locale, PublishCopy> = { en, es, fr, de, ja, ko, zh };
