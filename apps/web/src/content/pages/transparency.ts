import type { Locale } from '@/lib/i18n/locales';

/** /transparency copy in every locale (see content/pages/features.ts). */

const en = {
  metaTitle: 'Transparency: pricing, data and AI policies',
  metaDesc:
    'Published prices, plain-language data practices, AI that never trains on your drafts, and per-channel publishing results. How Sosial stays open.',
  kicker: 'Transparency',
  title: 'Nothing important stays in the fine print.',
  lede: 'Prices you can read before signing up, data practices in plain sentences, AI that never trains on your drafts, and publish results reported per channel. If it affects your work, you can see it.',
  publishedPrices: 'Published prices',
  /** Linked to Pricing, the privacy policy, AI assistant and Publish, in that order. */
  pillars: [
    {
      title: 'The price is on the page',
      body: 'Free, Solo, Team and Business are listed with what each includes, before you create an account. No per-channel upsells, no seat taxes, and price changes reach existing subscribers before they take effect.',
      linkLabel: 'See pricing',
    },
    {
      title: 'Your data is yours',
      body: 'We do not sell your content, your audience data or your schedule. Posts and drafts power your workspace and nothing else. Export or deletion is handled from support, in writing.',
      linkLabel: 'Read the privacy policy',
    },
    {
      title: 'A drafter, never a publisher',
      body: 'The AI writer researches, drafts and flags uncertainty with linked sources. It cannot schedule or publish anything, and your drafts are never used to train models.',
      linkLabel: 'How the AI works',
    },
    {
      title: 'Real limits, real results',
      body: 'Character limits in the composer are the platforms’ actual limits, enforced before scheduling. After publishing, each channel reports its own result.',
      linkLabel: 'How publishing works',
    },
  ],
  publishing: {
    kicker: 'Publishing',
    title: 'Failures are visible, not quietly retried.',
    body: 'When the worker ships a post, every channel reports back on its own: sent, publishing or failed, with the network’s reason. Fix the one that failed and re-queue just that channel.',
  },
  demo: {
    post: 'Launch post',
    when: 'Today, 09:00',
    /** Instagram, X, LinkedIn, TikTok. */
    statuses: ['Sent', 'Sent', 'Publishing', 'Failed, retry available'],
    note: 'Per-channel results land in the queue as they happen.',
  },
  faq: [
    {
      q: 'Do you train AI on what I write?',
      a: 'No. Briefs and drafts are not used to train models. Generated copy exists to serve your workspace and nothing else.',
    },
    {
      q: 'Who can see my scheduled posts?',
      a: 'People in your workspace, according to their role. Members see what they need to draft and review; connected accounts and billing stay with owners.',
    },
    {
      q: 'What happens when a platform changes a limit?',
      a: 'The limit updates in our channel data and the composer follows it. Every channel guide shows the number it is enforcing.',
    },
    {
      q: 'How do I get my data out?',
      a: 'Ask from support and you receive an export of your posts, schedule and workspace content. Deletion works the same way, in writing.',
    },
    {
      q: 'Will prices change without notice?',
      a: 'Existing subscribers get notice before a price change takes effect. The public pricing page always reflects what new customers pay today.',
    },
  ],
};

export type TransparencyCopy = typeof en;

const es: TransparencyCopy = {
  metaTitle: 'Transparencia: precios, datos y políticas de IA',
  metaDesc:
    'Precios publicados, prácticas de datos en lenguaje claro, IA que nunca se entrena con tus borradores y resultados de publicación por canal. Así se mantiene abierto Sosial.',
  kicker: 'Transparencia',
  title: 'Nada importante queda en la letra pequeña.',
  lede: 'Precios que puedes leer antes de registrarte, prácticas de datos en frases claras, IA que nunca se entrena con tus borradores y resultados de publicación por canal. Si afecta a tu trabajo, puedes verlo.',
  publishedPrices: 'Precios publicados',
  pillars: [
    { title: 'El precio está en la página', body: 'Free, Solo, Team y Business aparecen con todo lo que incluyen antes de crear una cuenta. Sin extras por canal, sin cobro por usuario, y los cambios de precio llegan a los suscriptores actuales antes de aplicarse.', linkLabel: 'Ver precios' },
    { title: 'Tus datos son tuyos', body: 'No vendemos tu contenido, los datos de tu audiencia ni tu calendario. Las publicaciones y los borradores solo sirven a tu espacio de trabajo. La exportación o eliminación se gestiona por escrito a través de soporte.', linkLabel: 'Leer la política de privacidad' },
    { title: 'Redacta, nunca publica', body: 'El redactor con IA investiga, redacta y señala las dudas con fuentes enlazadas. No puede programar ni publicar nada, y tus borradores nunca se usan para entrenar modelos.', linkLabel: 'Cómo funciona la IA' },
    { title: 'Límites reales, resultados reales', body: 'Los límites de caracteres del editor son los límites reales de cada plataforma y se aplican antes de programar. Tras publicar, cada canal informa de su propio resultado.', linkLabel: 'Cómo funciona la publicación' },
  ],
  publishing: {
    kicker: 'Publicación',
    title: 'Los fallos se ven, no se reintentan en silencio.',
    body: 'Cuando el servicio publica, cada canal informa por separado: enviada, publicándose o fallida, con el motivo de la red. Arregla la que falló y vuelve a poner en cola solo ese canal.',
  },
  demo: {
    post: 'Publicación de lanzamiento',
    when: 'Hoy, 09:00',
    statuses: ['Enviada', 'Enviada', 'Publicándose', 'Fallida, se puede reintentar'],
    note: 'Los resultados de cada canal llegan a la cola en cuanto ocurren.',
  },
  faq: [
    { q: '¿Entrenáis la IA con lo que escribo?', a: 'No. Las indicaciones y los borradores no se usan para entrenar modelos. El texto generado solo sirve a tu espacio de trabajo.' },
    { q: '¿Quién puede ver mis publicaciones programadas?', a: 'Las personas de tu espacio de trabajo, según su rol. Los miembros ven lo que necesitan para redactar y revisar; las cuentas conectadas y la facturación quedan en manos de los propietarios.' },
    { q: '¿Qué pasa cuando una plataforma cambia un límite?', a: 'El límite se actualiza en nuestros datos de canales y el editor lo sigue. Cada guía de canal muestra la cifra que aplica.' },
    { q: '¿Cómo saco mis datos?', a: 'Pídelo a soporte y recibirás una exportación de tus publicaciones, calendario y contenido del espacio de trabajo. La eliminación funciona igual, por escrito.' },
    { q: '¿Cambiarán los precios sin aviso?', a: 'Los suscriptores actuales reciben aviso antes de que un cambio de precio se aplique. La página de precios pública siempre muestra lo que pagan hoy los nuevos clientes.' },
  ],
};

const fr: TransparencyCopy = {
  metaTitle: 'Transparence : tarifs, données et politique d’IA',
  metaDesc:
    'Des tarifs publiés, des pratiques de données en langage clair, une IA jamais entraînée sur vos brouillons et des résultats de publication par canal. Comment Sosial reste ouvert.',
  kicker: 'Transparence',
  title: 'Rien d’important dans les petites lignes.',
  lede: 'Des tarifs lisibles avant l’inscription, des pratiques de données en phrases simples, une IA jamais entraînée sur vos brouillons et des résultats de publication par canal. Si cela touche votre travail, vous pouvez le voir.',
  publishedPrices: 'Tarifs publiés',
  pillars: [
    { title: 'Le prix est sur la page', body: 'Free, Solo, Team et Business sont présentés avec leur contenu avant même de créer un compte. Pas de supplément par canal ni par utilisateur, et les abonnés sont prévenus avant tout changement de prix.', linkLabel: 'Voir les tarifs' },
    { title: 'Vos données vous appartiennent', body: 'Nous ne vendons ni votre contenu, ni les données de votre audience, ni votre planning. Publications et brouillons ne servent que votre espace de travail. Export ou suppression se demandent par écrit au support.', linkLabel: 'Lire la politique de confidentialité' },
    { title: 'Il rédige, il ne publie jamais', body: 'Le rédacteur IA se documente, rédige et signale les incertitudes avec ses sources. Il ne peut rien planifier ni publier, et vos brouillons ne servent jamais à entraîner des modèles.', linkLabel: 'Comment fonctionne l’IA' },
    { title: 'De vraies limites, de vrais résultats', body: 'Les limites de caractères de l’éditeur sont celles des plateformes, appliquées avant la planification. Après publication, chaque canal rend compte de son propre résultat.', linkLabel: 'Comment fonctionne la publication' },
  ],
  publishing: {
    kicker: 'Publication',
    title: 'Les échecs sont visibles, pas relancés en silence.',
    body: 'Quand le service publie, chaque canal rend compte séparément : envoyé, en cours ou échoué, avec la raison donnée par le réseau. Corrigez celui qui a échoué et remettez seulement ce canal en file.',
  },
  demo: {
    post: 'Publication de lancement',
    when: 'Aujourd’hui, 09:00',
    statuses: ['Envoyé', 'Envoyé', 'En cours', 'Échoué, nouvel essai possible'],
    note: 'Les résultats par canal arrivent dans la file au fur et à mesure.',
  },
  faq: [
    { q: 'Entraînez-vous l’IA sur ce que j’écris ?', a: 'Non. Consignes et brouillons ne servent pas à entraîner des modèles. Le texte généré ne sert que votre espace de travail.' },
    { q: 'Qui peut voir mes publications planifiées ?', a: 'Les personnes de votre espace de travail, selon leur rôle. Les membres voient ce dont ils ont besoin pour rédiger et relire ; comptes connectés et facturation restent aux propriétaires.' },
    { q: 'Que se passe-t-il quand une plateforme change une limite ?', a: 'La limite est mise à jour dans nos données de canaux et l’éditeur suit. Chaque guide de canal affiche la valeur appliquée.' },
    { q: 'Comment récupérer mes données ?', a: 'Demandez-le au support et vous recevrez un export de vos publications, de votre planning et du contenu de l’espace de travail. La suppression fonctionne de la même façon, par écrit.' },
    { q: 'Les prix changeront-ils sans prévenir ?', a: 'Les abonnés sont prévenus avant qu’un changement de prix s’applique. La page des tarifs publique indique toujours ce que paient aujourd’hui les nouveaux clients.' },
  ],
};

const de: TransparencyCopy = {
  metaTitle: 'Transparenz: Preise, Daten und KI-Richtlinien',
  metaDesc:
    'Veröffentlichte Preise, Datenpraxis in klarer Sprache, KI, die nie mit deinen Entwürfen trainiert, und Veröffentlichungsergebnisse pro Kanal. So bleibt Sosial offen.',
  kicker: 'Transparenz',
  title: 'Nichts Wichtiges steht im Kleingedruckten.',
  lede: 'Preise, die du vor der Anmeldung lesen kannst, Datenpraxis in klaren Sätzen, KI, die nie mit deinen Entwürfen trainiert, und Ergebnisse pro Kanal. Wenn es deine Arbeit betrifft, kannst du es sehen.',
  publishedPrices: 'Veröffentlichte Preise',
  pillars: [
    { title: 'Der Preis steht auf der Seite', body: 'Free, Solo, Team und Business stehen mit allem, was sie enthalten, vor der Kontoerstellung da. Keine Aufpreise pro Kanal, keine Gebühren pro Platz, und Preisänderungen erreichen bestehende Abonnenten, bevor sie gelten.', linkLabel: 'Preise ansehen' },
    { title: 'Deine Daten gehören dir', body: 'Wir verkaufen weder deine Inhalte noch deine Zielgruppendaten oder deinen Zeitplan. Beiträge und Entwürfe dienen nur deinem Workspace. Export oder Löschung erledigt der Support, schriftlich.', linkLabel: 'Datenschutzerklärung lesen' },
    { title: 'Entwirft, veröffentlicht nie', body: 'Der KI-Texter recherchiert, entwirft und markiert Unsicherheiten mit verlinkten Quellen. Er kann nichts planen oder veröffentlichen, und deine Entwürfe werden nie zum Training genutzt.', linkLabel: 'So arbeitet die KI' },
    { title: 'Echte Limits, echte Ergebnisse', body: 'Die Zeichenlimits im Editor sind die tatsächlichen Limits der Plattformen und gelten schon vor dem Planen. Nach der Veröffentlichung meldet jeder Kanal sein eigenes Ergebnis.', linkLabel: 'So funktioniert das Veröffentlichen' },
  ],
  publishing: {
    kicker: 'Veröffentlichen',
    title: 'Fehler sind sichtbar, nicht still wiederholt.',
    body: 'Wenn der Dienst einen Beitrag veröffentlicht, meldet jeder Kanal einzeln zurück: gesendet, wird veröffentlicht oder fehlgeschlagen, mit dem Grund des Netzwerks. Behebe den fehlgeschlagenen und plane nur diesen Kanal neu ein.',
  },
  demo: {
    post: 'Launch-Beitrag',
    when: 'Heute, 09:00',
    statuses: ['Gesendet', 'Gesendet', 'Wird veröffentlicht', 'Fehlgeschlagen, erneut versuchbar'],
    note: 'Die Ergebnisse pro Kanal landen in der Warteschlange, sobald sie vorliegen.',
  },
  faq: [
    { q: 'Trainiert ihr KI mit dem, was ich schreibe?', a: 'Nein. Briefings und Entwürfe werden nicht zum Training genutzt. Generierter Text dient nur deinem Workspace.' },
    { q: 'Wer kann meine geplanten Beiträge sehen?', a: 'Die Personen in deinem Workspace, je nach Rolle. Mitglieder sehen, was sie zum Entwerfen und Prüfen brauchen; verbundene Konten und Abrechnung bleiben bei den Inhabern.' },
    { q: 'Was passiert, wenn eine Plattform ein Limit ändert?', a: 'Das Limit wird in unseren Kanaldaten aktualisiert und der Editor folgt. Jeder Kanal-Leitfaden zeigt den Wert, der gilt.' },
    { q: 'Wie bekomme ich meine Daten heraus?', a: 'Frag beim Support an und du erhältst einen Export deiner Beiträge, deines Zeitplans und der Workspace-Inhalte. Löschen funktioniert genauso, schriftlich.' },
    { q: 'Ändern sich die Preise ohne Ankündigung?', a: 'Bestehende Abonnenten werden informiert, bevor eine Preisänderung gilt. Die öffentliche Preisseite zeigt immer, was Neukunden heute zahlen.' },
  ],
};

const ja: TransparencyCopy = {
  metaTitle: '透明性：料金、データ、AIポリシー',
  metaDesc:
    '公開された料金、わかりやすい言葉で書いたデータの扱い、下書きを学習に使わないAI、チャネルごとの公開結果。Sosialがオープンであり続ける方法。',
  kicker: '透明性',
  title: '大切なことを細則に隠さない。',
  lede: '登録前に読める料金、わかりやすい文章で書いたデータの扱い、下書きを学習に使わないAI、チャネルごとに報告される公開結果。あなたの仕事に関わることは、すべて見えるようにしています。',
  publishedPrices: '公開料金',
  pillars: [
    { title: '料金はページに明記', body: 'Free、Solo、Team、Businessの内容は、アカウント作成前に確認できます。チャネルごとの追加料金も、人数課金もありません。料金を変更する場合は、適用前に既存の契約者へお知らせします。', linkLabel: '料金を見る' },
    { title: 'データはあなたのもの', body: 'コンテンツ、オーディエンスのデータ、スケジュールを販売することはありません。投稿と下書きはあなたのワークスペースのためだけに使われます。エクスポートや削除はサポートが書面で対応します。', linkLabel: 'プライバシーポリシーを読む' },
    { title: '下書きはしても、公開はしない', body: 'AIライターは調査し、下書きし、不確かな点を出典リンク付きで示します。予約や公開はできず、下書きがモデルの学習に使われることもありません。', linkLabel: 'AIの仕組み' },
    { title: '本当の制限、本当の結果', body: 'エディターの文字数制限は各プラットフォームの実際の制限で、予約前に適用されます。公開後は、チャネルごとに結果が報告されます。', linkLabel: '公開の仕組み' },
  ],
  publishing: {
    kicker: '投稿',
    title: '失敗は見える形に。黙って再試行しません。',
    body: '公開時には、各チャネルが個別に結果を報告します。送信済み、公開中、失敗のいずれかと、ネットワークが示した理由です。失敗したものを直し、そのチャネルだけ再予約できます。',
  },
  demo: {
    post: 'ローンチ投稿',
    when: '今日 09:00',
    statuses: ['送信済み', '送信済み', '公開中', '失敗（再試行可能）'],
    note: 'チャネルごとの結果は、発生次第キューに届きます。',
  },
  faq: [
    { q: '私が書いた内容でAIを学習させますか？', a: 'いいえ。指示や下書きがモデルの学習に使われることはありません。生成された文章は、あなたのワークスペースのためだけに存在します。' },
    { q: '予約投稿は誰が見られますか？', a: 'ワークスペースのメンバーが、それぞれの権限に応じて見られます。メンバーは下書きと確認に必要なものだけを見られ、接続アカウントと請求はオーナーが管理します。' },
    { q: 'プラットフォームが制限を変更したら？', a: '当社のチャネルデータで制限を更新し、エディターもそれに従います。各チャネルのガイドに、適用している数値を掲載しています。' },
    { q: 'データを取り出すには？', a: 'サポートにご依頼いただければ、投稿、スケジュール、ワークスペースのコンテンツをエクスポートしてお送りします。削除も同じく書面で対応します。' },
    { q: '予告なく料金が変わることはありますか？', a: '料金変更が適用される前に、既存の契約者へお知らせします。公開されている料金ページには、常に新規のお客様が現在支払う金額を掲載しています。' },
  ],
};

const ko: TransparencyCopy = {
  metaTitle: '투명성: 요금, 데이터, AI 정책',
  metaDesc:
    '공개된 요금, 쉬운 말로 쓴 데이터 처리 방식, 초안으로 학습하지 않는 AI, 채널별 게시 결과. Sosial이 투명하게 운영하는 방법.',
  kicker: '투명성',
  title: '중요한 건 깨알 같은 글씨에 숨기지 않습니다.',
  lede: '가입 전에 읽을 수 있는 요금, 쉬운 문장으로 쓴 데이터 처리 방식, 초안으로 학습하지 않는 AI, 채널별로 보고되는 게시 결과. 내 일에 영향을 주는 것이라면 모두 볼 수 있어요.',
  publishedPrices: '공개된 요금',
  pillars: [
    { title: '요금은 페이지에 그대로', body: 'Free, Solo, Team, Business의 포함 내용을 계정을 만들기 전에 확인할 수 있습니다. 채널별 추가 요금도, 인원당 요금도 없으며, 요금이 바뀌면 적용 전에 기존 구독자에게 먼저 알립니다.', linkLabel: '요금 보기' },
    { title: '데이터는 내 것', body: '콘텐츠, 오디언스 데이터, 일정을 판매하지 않습니다. 게시물과 초안은 오직 내 워크스페이스를 위해 쓰입니다. 내보내기나 삭제는 지원팀이 서면으로 처리합니다.', linkLabel: '개인정보 처리방침 읽기' },
    { title: '초안은 쓰지만 게시는 하지 않아요', body: 'AI 작성 도우미는 리서치하고, 초안을 쓰고, 불확실한 점을 출처 링크와 함께 표시합니다. 예약이나 게시는 할 수 없고, 초안은 절대 모델 학습에 쓰이지 않습니다.', linkLabel: 'AI 작동 방식' },
    { title: '실제 제한, 실제 결과', body: '작성기의 글자 수 제한은 플랫폼의 실제 제한이며 예약 전에 적용됩니다. 게시 후에는 채널마다 각자의 결과를 보고합니다.', linkLabel: '게시 작동 방식' },
  ],
  publishing: {
    kicker: '게시',
    title: '실패는 조용히 재시도하지 않고 보여 줍니다.',
    body: '게시할 때 채널마다 따로 결과를 보고합니다. 전송됨, 게시 중, 실패와 함께 네트워크가 알려 준 이유까지요. 실패한 것을 고치고 그 채널만 다시 예약하세요.',
  },
  demo: {
    post: '출시 게시물',
    when: '오늘 09:00',
    statuses: ['전송됨', '전송됨', '게시 중', '실패, 다시 시도 가능'],
    note: '채널별 결과는 생기는 대로 대기열에 표시됩니다.',
  },
  faq: [
    { q: '제가 쓴 글로 AI를 학습시키나요?', a: '아니요. 요청과 초안은 모델 학습에 쓰이지 않습니다. 생성된 글은 오직 내 워크스페이스를 위해 존재합니다.' },
    { q: '예약 게시물은 누가 볼 수 있나요?', a: '워크스페이스의 사람들이 각자 역할에 따라 볼 수 있습니다. 멤버는 초안 작성과 검토에 필요한 것만 보고, 연결된 계정과 결제는 소유자가 관리합니다.' },
    { q: '플랫폼이 제한을 바꾸면 어떻게 되나요?', a: '채널 데이터의 제한을 업데이트하고 작성기도 이를 따릅니다. 각 채널 가이드에 적용 중인 숫자가 나와 있어요.' },
    { q: '내 데이터를 내보내려면?', a: '지원팀에 요청하면 게시물, 일정, 워크스페이스 콘텐츠를 내보내 드립니다. 삭제도 같은 방식으로, 서면으로 처리합니다.' },
    { q: '예고 없이 요금이 바뀌나요?', a: '요금 변경이 적용되기 전에 기존 구독자에게 알립니다. 공개 요금 페이지에는 항상 신규 고객이 지금 내는 금액이 나와 있습니다.' },
  ],
};

const zh: TransparencyCopy = {
  metaTitle: '透明度：价格、数据与 AI 政策',
  metaDesc: '公开的价格、用浅白语言说明的数据做法、从不用你的草稿训练的 AI，以及按渠道反馈的发布结果。Sosial 如何保持公开透明。',
  kicker: '透明度',
  title: '重要的事，不藏在小字里。',
  lede: '注册前就能看到的价格、用简单句子说明的数据做法、从不用你的草稿训练的 AI，以及按渠道报告的发布结果。只要影响你的工作，你都看得见。',
  publishedPrices: '公开价格',
  pillars: [
    { title: '价格就写在页面上', body: 'Free、Solo、Team 和 Business 各自包含什么，在创建账号前就列得清清楚楚。没有按渠道加价，没有按席位收费，价格变动会在生效前先通知现有订阅用户。', linkLabel: '查看价格' },
    { title: '你的数据属于你', body: '我们不出售你的内容、受众数据或排期。帖子和草稿只服务于你的工作区。导出或删除由客服以书面方式处理。', linkLabel: '阅读隐私政策' },
    { title: '只起草，从不发布', body: 'AI 写作助手负责调研、起草，并用来源链接标出不确定之处。它不能排期或发布任何内容，你的草稿也从不用于训练模型。', linkLabel: 'AI 如何工作' },
    { title: '真实的限制，真实的结果', body: '编辑器中的字数限制就是平台的真实限制，在排期前就会执行。发布后，每个渠道都会报告各自的结果。', linkLabel: '发布如何运作' },
  ],
  publishing: {
    kicker: '发布',
    title: '失败清晰可见，不会悄悄重试。',
    body: '服务发布帖子时，每个渠道都会单独反馈：已发送、发布中或失败，并附上网络给出的原因。修复失败的那个，只需重新排期该渠道。',
  },
  demo: {
    post: '上线帖子',
    when: '今天 09:00',
    statuses: ['已发送', '已发送', '发布中', '失败，可重试'],
    note: '各渠道的结果会实时出现在队列中。',
  },
  faq: [
    { q: '你们会用我写的内容训练 AI 吗？', a: '不会。指令和草稿不会用于训练模型。生成的文案只服务于你的工作区。' },
    { q: '谁能看到我的排期帖子？', a: '你工作区里的成员，按各自角色可见。成员能看到起草和审核所需的内容；已连接的账号和账单由所有者管理。' },
    { q: '平台修改限制时会怎样？', a: '我们会更新渠道数据中的限制，编辑器随之调整。每个渠道指南都会显示当前执行的数值。' },
    { q: '如何导出我的数据？', a: '向客服提出申请，你会收到帖子、排期和工作区内容的导出文件。删除也是同样的方式，以书面形式处理。' },
    { q: '价格会不经通知就变动吗？', a: '价格变动生效前会先通知现有订阅用户。公开的价格页面始终显示新客户当前支付的价格。' },
  ],
};

export const transparencyCopy: Record<Locale, TransparencyCopy> = { en, es, fr, de, ja, ko, zh };
