const fs = require('fs/promises');
const path = require('path');
const cheerio = require('cheerio');

const SiteRoutes = require('../assets/js/core/site-routes.js');
const ES_STATIC = require('../data/i18n/es-static.json');
const ES_CATALOG = require('../data/i18n/es-catalog.json');
let GENERATED_MANIFEST = { products: [], categories: [] };

try {
    GENERATED_MANIFEST = require('../assets/js/generated/catalog-seo-manifest.js');
} catch {
    GENERATED_MANIFEST = { products: [], categories: [] };
}

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_PAGES_DIR = path.join(ROOT_DIR, 'pages');
const SOURCE_PRODUCTS_DIR = path.join(ROOT_DIR, 'produto');
const SOURCE_CATEGORIES_DIR = path.join(ROOT_DIR, 'produtos');
const SOURCE_SITEMAP_DIR = path.join(ROOT_DIR, 'sitemaps');
const OUTPUT_ROOT = path.join(ROOT_DIR, 'es');
const OUTPUT_SITEMAPS_DIR = path.join(ROOT_DIR, 'sitemaps');
const CANONICAL_ORIGIN = SiteRoutes.getCanonicalOrigin();

const STATIC_PAGE_ROUTES = {
    'index.html': '',
    'produtos.html': 'produtos',
    'sobre.html': 'sobre',
    'contacto.html': 'contacto',
    'faq.html': 'faq',
    'envios.html': 'envios',
    'devolucoes.html': 'devolucoes',
    'privacidade.html': 'privacidade',
    'termos.html': 'termos',
    'checkout.html': 'checkout',
    'checkout-sucesso.html': 'checkout/sucesso',
    'encomendas.html': 'encomendas',
    'encomenda.html': 'encomenda',
    'personalizar.html': 'personalizar',
    'templates-gallery.html': 'modelos'
};

const EXTRA_TEXT_REPLACEMENTS = [
    ['Todas as categorias', 'Todas las categorías'],
    ['Catálogo de produtos publicitários', 'Catálogo de productos publicitarios'],
    ['Escolha a categoria certa, compare os modelos e avance para a personalização quando já souber o formato ideal.', 'Elija la categoría adecuada, compare los modelos y avance a la personalización cuando sepa el formato ideal.'],
    ['Escolha a categoria certa, compare os modelos e avance para a personalizacao quando ja souber o formato ideal.', 'Elija la categoría adecuada, compare los modelos y avance a la personalización cuando sepa el formato ideal.'],
    ['Fly banners personalizados para exterior e eventos com forte impacto visual, várias bases e formatos profissionais.', 'Fly banners personalizados para exterior y eventos con gran impacto visual, varias bases y formatos profesionales.'],
    ['Categoria', 'Categoría'],
    ['Ordenar', 'Ordenar'],
    ['Destaques', 'Destacados'],
    ['Preço: menor primeiro', 'Precio: menor primero'],
    ['Preço: maior primeiro', 'Precio: mayor primero'],
    ['Nome: A-Z', 'Nombre: A-Z'],
    ['Nome: Z-A', 'Nombre: Z-A'],
    ['Envios e prazos', 'Envíos y plazos'],
    ['Envios e Entregas', 'Envíos y entregas'],
    ['Ver mais', 'Ver más'],
    ['Tente ajustar os filtros ou mudar a categoria.', 'Intente ajustar los filtros o cambiar la categoría.'],
    ['Nenhum produto encontrado', 'No se ha encontrado ningún producto'],
    ['Pedir apoio', 'Solicitar ayuda'],
    ['Pensado para criar presença vertical em eventos, entradas e pontos de passagem, com montagem simples, transporte fácil e boa leitura à distância.', 'Pensado para crear presencia vertical en eventos, entradas y puntos de paso, con montaje sencillo, transporte fácil y buena lectura a distancia.'],
    ['Indicado para fundos de marca, montras e espaços promocionais onde a comunicação precisa de escala e leitura limpa.', 'Indicado para fondos de marca, escaparates y espacios promocionales donde la comunicación necesita escala y lectura limpia.'],
    ['Uma solução compacta para comunicação profissional em feiras, receções e apresentações, pronta para montar e transportar com facilidade.', 'Una solución compacta para comunicación profesional en ferias, recepciones y presentaciones, lista para montar y transportar con facilidad.'],
    ['Leve, direto e fácil de instalar, funciona bem em campanhas temporárias, ações interiores e espaços comerciais com rotação frequente.', 'Ligero, directo y fácil de instalar, funciona bien en campañas temporales, acciones interiores y espacios comerciales con rotación frecuente.'],
    ['Feita para dar visibilidade a marcas, instituições e mensagens em contexto formal, promocional ou coletivo.', 'Hecha para dar visibilidad a marcas, instituciones y mensajes en contexto formal, promocional o colectivo.'],
    ['Formato prático para clubes, torneios e momentos de prémio, com leitura clara e presença visual em ambientes desportivos.', 'Formato práctico para clubes, torneos y entregas de premios, con lectura clara y presencia visual en entornos deportivos.'],
    ['Cria um fundo de marca para fotografia, imprensa e ativações, ajudando o espaço do evento a parecer mais profissional.', 'Crea un fondo de marca para fotografía, prensa y activaciones, ayudando a que el espacio del evento parezca más profesional.'],
    ['Uma peça compacta para destacar marca, campanha ou mensagem em balcões, montras e pontos de contacto com o cliente.', 'Una pieza compacta para destacar marca, campaña o mensaje en mostradores, escaparates y puntos de contacto con el cliente.'],
    ['Solução para elevar bandeiras em espaços exteriores, fachadas e zonas institucionais com presença clara e duradoura.', 'Solución para elevar banderas en espacios exteriores, fachadas y zonas institucionales con presencia clara y duradera.'],
    ['Indicada para eventos exteriores e ativações onde a marca precisa de cobertura, presença e identificação imediata.', 'Indicada para eventos exteriores y activaciones donde la marca necesita cobertura, presencia e identificación inmediata.'],
    ['Produto personalizável para comunicação física, pensado para tornar a marca mais visível no ponto certo.', 'Producto personalizable para comunicación física, pensado para hacer la marca más visible en el punto adecuado.'],
    ['Produção rápida', 'Producción rápida'],
    ['Fluxo preparado para avançar sem troca de emails.', 'Flujo preparado para avanzar sin intercambio de emails.'],
    ['Personalização online', 'Personalización online'],
    ['Editor online', 'Editor online'],
    ['Apoio antes de produzir', 'Apoyo antes de producir'],
    ['Edita o design e confirma o resultado antes de encomendar.', 'Edite el diseño y confirme el resultado antes de pedir.'],
    ['Edite o design e confirme o resultado antes de encomendar.', 'Edite el diseño y confirme el resultado antes de pedir.'],
    ['Apoio na arte-final', 'Apoyo en el arte final'],
    ['A equipa ajuda quando o ficheiro precisa de ajustes.', 'El equipo ayuda cuando el archivo necesita ajustes.'],
    ['Entrega em Portugal e Espanha', 'Entrega en Portugal y España'],
    ['Envio preparado para o destino indicado no checkout.', 'Envío preparado para el destino indicado en el checkout.'],
    ['Informacoes', 'Información'],
    ['Ideal para', 'Ideal para'],
    ['O que recebe', 'Lo que recibe'],
    ['Como funciona', 'Cómo funciona'],
    ['Detalhes técnicos', 'Detalles técnicos'],
    ['Ao continuar, o checkout seguro aparece abaixo, sem sair da IberFlag.', 'Al continuar, el checkout seguro aparece abajo, sin salir de IberFlag.'],
    ['Métodos mostrados no passo seguinte', 'Métodos mostrados en el siguiente paso'],
    ['Cartão, MB Way, Multibanco e outros métodos compatíveis surgem automaticamente conforme o cliente e a encomenda.', 'Tarjeta, MB Way, Multibanco y otros métodos compatibles aparecen automáticamente según el cliente y el pedido.'],
    ['O pagamento fica dentro da IberFlag. Só sai deste fluxo se o próprio método pedir autenticação externa.', 'El pago permanece dentro de IberFlag. Solo sale de este flujo si el propio método pide autenticación externa.'],
    ['Quando abrir o pagamento, bloqueamos estes dados para evitar diferenças entre a encomenda e a cobrança.', 'Cuando se abra el pago, bloqueamos estos datos para evitar diferencias entre el pedido y el cobro.'],
    ['Pagamento em aberto. Para alterar dados ou carrinho, atualize a página antes de criar uma nova sessão.', 'Pago abierto. Para cambiar datos o carrito, actualice la página antes de crear una nueva sesión.'],
    ['Pagamento seguro', 'Pago seguro'],
    ['Complete o pagamento abaixo. A confirmação da encomenda acontece no final do processo.', 'Complete el pago abajo. La confirmación del pedido ocurre al final del proceso.'],
    ['A preparar o pagamento seguro...', 'Preparando el pago seguro...'],
    ['Abrir pagamento seguro', 'Abrir pago seguro'],
    ['Contacto e faturação', 'Contacto y facturación'],
    ['Dados mínimos para identificar a encomenda e preparar o pagamento.', 'Datos mínimos para identificar el pedido y preparar el pago.'],
    ['O NIF continua opcional para particulares.', 'El NIF sigue siendo opcional para particulares.'],
    ['Preencha se quiser associar número fiscal à encomenda.', 'Complételo si desea asociar un número fiscal al pedido.'],
    ['Continuar para morada', 'Continuar a dirección'],
    ['Entrega e faturação', 'Entrega y facturación'],
    ['Use uma única morada para simplificar a encomenda.', 'Use una única dirección para simplificar el pedido.'],
    ['Usar esta morada para entrega e faturação', 'Usar esta dirección para entrega y facturación'],
    ['Não pedimos uma segunda morada.', 'No pedimos una segunda dirección.'],
    ['Rever e pagar', 'Revisar y pagar'],
    ['O pagamento abre aqui na loja com Stripe.', 'El pago se abre aquí en la tienda con Stripe.'],
    ['Cartão, MB Way e Multibanco aparecem conforme disponibilidade.', 'Tarjeta, MB Way y Multibanco aparecen según disponibilidad.'],
    ['Métodos de pagamento', 'Métodos de pago'],
    ['Cartão', 'Tarjeta'],
    ['Informações adicionais para a equipa.', 'Información adicional para el equipo.'],
    ['Adicionar revisão de design por', 'Añadir revisión de diseño por'],
    ['Ver termos', 'Ver términos'],
    ['Complete o pagamento abaixo para confirmar a encomenda.', 'Complete el pago abajo para confirmar el pedido.'],
    ['Confirme produtos, quantidades e total antes de pagar.', 'Confirme productos, cantidades y total antes de pagar.'],
    ['Pagamento seguro dentro da loja.', 'Pago seguro dentro de la tienda.'],
    ['Preencha os dados de contacto e faturação antes de continuar.', 'Complete los datos de contacto y facturación antes de continuar.'],
    ['Preencha a morada de entrega antes de continuar.', 'Complete la dirección de entrega antes de continuar.'],
    ['Aceite os termos para continuar.', 'Acepte los términos para continuar.'],
    ['Dados', 'Datos'],
    ['Morada', 'Dirección'],
    ['Voltar', 'Volver'],
    ['Telemóvel / telefone', 'Móvil / teléfono'],
    ['Grátis', 'Gratis'],
    ['IVA calculado no checkout', 'IVA calculado en el checkout'],
    ['Personalização incluída', 'Personalización incluida'],
    ['itens incluídos', 'artículos incluidos'],
    ['3 passos', '3 pasos'],
    ['Dimensão', 'Dimensión'],
    ['Categoria', 'Categoría'],
    ['Formato', 'Formato'],
    ['Arte-final', 'Arte final'],
    ['Formato indicado no produto', 'Formato indicado en el producto'],
    ['Personalize online ou avance com o seu ficheiro.', 'Personalice online o avance con su archivo.'],
    ['Personalize online ou envie o design.', 'Personalice online o envíe el diseño.'],
    ['Personaliza o design ou avança com a tua arte-final.', 'Personalice el diseño o avance con su arte final.'],
    ['Personalize o design ou avance com a sua arte-final.', 'Personalice el diseño o avance con su arte final.'],
    ['Confirma opções, preço e pré-visualização.', 'Confirme opciones, precio y vista previa.'],
    ['Confirme opções, preço e pré-visualização.', 'Confirme opciones, precio y vista previa.'],
    ['Finaliza a encomenda e a produção fica encaminhada.', 'Finalice el pedido y la producción queda encaminada.'],
    ['Finalize a encomenda e a produção fica encaminhada.', 'Finalice el pedido y la producción queda encaminada.'],
    ['Compare antes de decidir', 'Compare antes de decidir'],
    ['Outros tamanhos deste formato', 'Otros tamaños de este formato'],
    ['Compare alternativas da categoria', 'Compare alternativas de la categoría'],
    ['para escolher o tamanho e formato certo.', 'para elegir el tamaño y formato adecuado.'],
    ['Feiras e eventos', 'Ferias y eventos'],
    ['Montras e entradas', 'Escaparates y entradas'],
    ['Pontos de venda', 'Puntos de venta'],
    ['Ações de rua', 'Acciones de calle'],
    ['Stands e exposições', 'Stands y exposiciones'],
    ['Fundos de palco', 'Fondos de escenario'],
    ['Campanhas de grande formato', 'Campañas de gran formato'],
    ['Feiras', 'Ferias'],
    ['Receções', 'Recepciones'],
    ['Apresentações', 'Presentaciones'],
    ['Promoções interiores', 'Promociones interiores'],
    ['Campanhas temporárias', 'Campañas temporales'],
    ['Lojas', 'Tiendas'],
    ['Eventos e campanhas', 'Eventos y campañas'],
    ['Institucional', 'Institucional'],
    ['Desporto e escolas', 'Deporte y escuelas'],
    ['Manifestações', 'Manifestaciones'],
    ['Clubes e torneios', 'Clubes y torneos'],
    ['Bancadas', 'Gradas'],
    ['Entregas de prémios', 'Entregas de premios'],
    ['Eventos corporativos', 'Eventos corporativos'],
    ['Conferências', 'Conferencias'],
    ['Zonas de fotografia', 'Zonas de fotografía'],
    ['Lançamentos de marca', 'Lanzamientos de marca'],
    ['Ativações de marca', 'Activaciones de marca'],
    ['Montras', 'Escaparates'],
    ['Exposições', 'Exposiciones'],
    ['Exterior institucional', 'Exterior institucional'],
    ['Fachadas', 'Fachadas'],
    ['Recintos', 'Recintos'],
    ['Sinalização de bandeiras', 'Señalización de banderas'],
    ['Eventos exteriores', 'Eventos exteriores'],
    ['Ações de marca', 'Acciones de marca'],
    ['Zonas promocionais', 'Zonas promocionales'],
    ['Eventos', 'Eventos'],
    ['Campanhas', 'Campañas'],
    ['Produto impresso personalizado', 'Producto impreso personalizado'],
    ['Escolha da base compatível no passo seguinte', 'Elección de la base compatible en el siguiente paso'],
    ['Pré-visualização antes de encomendar', 'Vista previa antes de pedir'],
    ['Pronto para encomendar depois de validar opções', 'Listo para pedir después de validar opciones'],
    ['Apoio se precisares de ajustar a arte-final', 'Apoyo si necesita ajustar el arte final'],
    ['Apoio se for preciso ajustar a arte-final', 'Apoyo si es necesario ajustar el arte final'],
    ['Impressão personalizada para fundo ou parede', 'Impresión personalizada para fondo o pared'],
    ['Formato preparado para comunicação de impacto', 'Formato preparado para comunicación de impacto'],
    ['Impressão personalizada do roll up', 'Impresión personalizada del roll up'],
    ['Formato pensado para transporte e montagem rápida', 'Formato pensado para transporte y montaje rápido'],
    ['Impressão personalizada do X-Banner', 'Impresión personalizada del X-Banner'],
    ['Formato leve para montagem rápida', 'Formato ligero para montaje rápido'],
    ['Bandeira personalizada no formato escolhido', 'Bandera personalizada en el formato elegido'],
    ['Impressão orientada para boa leitura', 'Impresión orientada a buena lectura'],
    ['Bandeirola personalizada', 'Banderín personalizado'],
    ['Formato adequado para contexto desportivo', 'Formato adecuado para contexto deportivo'],
    ['Photocall personalizado', 'Photocall personalizado'],
    ['Formato preparado para imagem de marca', 'Formato preparado para imagen de marca'],
    ['Cubo publicitário personalizado', 'Cubo publicitario personalizado'],
    ['Comunicação visível em várias faces', 'Comunicación visible en varias caras'],
    ['Mastro indicado para suporte de bandeira', 'Mástil indicado para soporte de bandera'],
    ['Formato preparado para presença exterior', 'Formato preparado para presencia exterior'],
    ['Tenda personalizada no formato escolhido', 'Carpa personalizada en el formato elegido'],
    ['Comunicação preparada para exterior', 'Comunicación preparada para exterior'],
    ['Formato configurado para encomenda online', 'Formato configurado para pedido online'],
    ['Suporte vertical portátil', 'Soporte vertical portátil'],
    ['Fundo promocional vertical', 'Fondo promocional vertical'],
    ['Sistema retrátil', 'Sistema retráctil'],
    ['Estrutura leve em X', 'Estructura ligera en X'],
    ['Bandeira personalizada', 'Bandera personalizada'],
    ['Bandeirola desportiva', 'Banderín deportivo'],
    ['Backdrop de evento', 'Backdrop de evento'],
    ['Peça promocional 360 graus', 'Pieza promocional 360 grados'],
    ['Suporte exterior para bandeira', 'Soporte exterior para bandera'],
    ['Estrutura promocional exterior', 'Estructura promocional exterior'],
    ['Produto publicitário personalizado', 'Producto publicitario personalizado']
];

const STATIC_SEO_OVERRIDES_ES = {
    '/sobre': {
        title: 'Sobre IberFlag | Producción publicitaria',
        description: 'Conozca IberFlag, su operación, su enfoque de producción y su atención a productos publicitarios personalizados.'
    },
    '/contacto': {
        title: 'Contacto IberFlag | Presupuestos y atención',
        description: 'Hable con el equipo IberFlag para solicitar presupuesto, apoyo de diseño, estado de pedidos e información comercial.'
    },
    '/envios': {
        title: 'Envíos y entregas | IberFlag',
        description: 'Información sobre producción, expedición, plazos y entregas de productos personalizados IberFlag.'
    },
    '/devolucoes': {
        title: 'Devoluciones y reclamaciones | IberFlag',
        description: 'Política de devoluciones IberFlag para productos personalizados, cancelaciones, defectos y análisis de incidencias.'
    },
    '/privacidade': {
        title: 'Política de privacidad | IberFlag',
        description: 'Sepa cómo IberFlag trata datos personales, solicitudes de contacto, pedidos y comunicaciones comerciales.'
    },
    '/termos': {
        title: 'Términos y condiciones | IberFlag',
        description: 'Consulte las condiciones de venta, producción, facturación, pagos, entregas y responsabilidad de IberFlag.'
    },
    '/faq': {
        title: 'FAQ IberFlag | Preguntas frecuentes',
        description: 'Respuestas sobre plazos, personalización, pago, envío y funcionamiento de los pedidos en IberFlag.'
    },
    '/encomendas': {
        title: 'Mis pedidos IberFlag | Seguimiento online',
        description: 'Busque y siga sus pedidos IberFlag con código y email para consultar el estado actualizado.'
    },
    '/encomenda': {
        title: 'Seguimiento de pedido | IberFlag',
        description: 'Acompañe el estado detallado de su pedido IberFlag y consulte la información actualizada online.'
    }
};

const TEXT_REPLACEMENTS = (Array.isArray(ES_STATIC.replacements) ? ES_STATIC.replacements : [
    ['IberFlag - Flybanners e Publicidade Física Personalizada', 'IberFlag - Fly banners y publicidad física personalizada'],
    ['Especialistas em flybanners, roll-ups e produtos publicitários com operação principal em Portugal, produção rápida e apoio dedicado.', 'Especialistas en fly banners, roll ups y productos publicitarios con operación principal en Portugal, producción rápida y apoyo dedicado.'],
    ['Especialistas em flybanners, roll-ups e produtos publicitários com operação principal em Portugal.', 'Especialistas en fly banners, roll ups y productos publicitarios con operación principal en Portugal.'],
    ['Fale com a equipa IberFlag para apoio comercial e técnico.', 'Hable con el equipo IberFlag para apoyo comercial y técnico.'],
    ['Informação de prazos, tracking e cobertura de entregas confirmada no checkout.', 'Información de plazos, tracking y cobertura de entregas confirmada en el checkout.'],
    ['Respostas a perguntas frequentes sobre prazos, personalização, pagamento, envio e funcionamento das encomendas na IberFlag.', 'Respuestas a preguntas frecuentes sobre plazos, personalización, pago, envío y funcionamiento de los pedidos en IberFlag.'],
    ['Flybanners', 'Fly banners'],
    ['Flybanner', 'Fly banner'],
    ['Roll Up', 'Roll Up'],
    ['Publicidade física', 'Publicidad física'],
    ['tratada como marca.', 'tratada como marca.'],
    ['Publicidade Fisica', 'Publicidad física'],
    ['tratada como marca.', 'tratada como marca.'],
    ['Início', 'Inicio'],
    ['Sobre Nós', 'Sobre nosotros'],
    ['Produtos', 'Productos'],
    ['Contacto', 'Contacto'],
    ['Carrinho de Compras', 'Carrito de compra'],
    ['Carrinho', 'Carrito'],
    ['Abrir carrinho', 'Abrir carrito'],
    ['Abrir menu', 'Abrir menú'],
    ['Ver Catálogo', 'Ver catálogo'],
    ['Ver Catalogo', 'Ver catálogo'],
    ['Ver Todos os Produtos', 'Ver todos los productos'],
    ['Ver Todos os Produtos', 'Ver todos los productos'],
    ['Falar com Consultor', 'Hablar con un asesor'],
    ['Falar com a equipa', 'Hablar con el equipo'],
    ['Falar com Consultor', 'Hablar con un asesor'],
    ['Os formatos mais pedidos.', 'Los formatos más solicitados.'],
    ['Peças escolhidas por marcas que precisam de rapidez sem abdicar da apresentação.', 'Piezas elegidas por marcas que necesitan rapidez sin renunciar a la presentación.'],
    ['Escolha o formato certo para o espaço.', 'Elija el formato adecuado para el espacio.'],
    ['Cada solução foi pensada para criar presença com leitura clara, montagem simples e impacto imediato.', 'Cada solución está pensada para crear presencia con lectura clara, montaje sencillo e impacto inmediato.'],
    ['Entrega Preparada', 'Entrega preparada'],
    ['Qualidade Controlada', 'Calidad controlada'],
    ['Direção Visual', 'Dirección visual'],
    ['Presença Premium', 'Presencia premium'],
    ['produção e envio coordenados', 'producción y envío coordinados'],
    ['acabamento profissional', 'acabado profesional'],
    ['apoio gráfico orientado à marca', 'apoyo gráfico orientado a la marca'],
    ['concebido para impressionar', 'concebido para impresionar'],
    ['Entre em Contacto', 'Póngase en contacto'],
    ['Entre em contacto', 'Póngase en contacto'],
    ['Estamos aqui para ajudar a preparar, validar e acompanhar a sua encomenda.', 'Estamos aquí para ayudarle a preparar, validar y seguir su pedido.'],
    ['Envie-nos uma Mensagem', 'Envíenos un mensaje'],
    ['Selecione um assunto', 'Seleccione un asunto'],
    ['Pedido de Orçamento', 'Solicitud de presupuesto'],
    ['Informação sobre Produtos', 'Información sobre productos'],
    ['Estado de Encomenda', 'Estado del pedido'],
    ['Reclamação', 'Reclamación'],
    ['Escreva a sua mensagem aqui...', 'Escriba su mensaje aquí...'],
    ['Aceito a', 'Acepto la'],
    ['autorizo o tratamento dos meus dados pessoais', 'autorizo el tratamiento de mis datos personales'],
    ['Perguntas Frequentes', 'Preguntas frecuentes'],
    ['Talvez a sua resposta já esteja aqui', 'Quizás su respuesta ya esté aquí'],
    ['Prazos de Entrega', 'Plazos de entrega'],
    ['Métodos de Pagamento', 'Métodos de pago'],
    ['Design Gráfico', 'Diseño gráfico'],
    ['Envios e Entregas', 'Envíos y entregas'],
    ['Devoluções', 'Devoluciones'],
    ['Política de Privacidade', 'Política de privacidad'],
    ['Termos e Condições', 'Términos y condiciones'],
    ['Minhas Encomendas', 'Mis pedidos'],
    ['Detalhe da Encomenda', 'Detalle del pedido'],
    ['Personalizar Produto', 'Personalizar producto'],
    ['Escolher Template', 'Elegir plantilla'],
    ['Mapa do Site', 'Mapa del sitio'],
    ['Produtos personalizados', 'Productos personalizados'],
    ['Produtos publicitários', 'Productos publicitarios'],
    ['Ver produto', 'Ver producto'],
    ['Ver tudo', 'Ver todo'],
    ['Continue a explorar', 'Siga explorando'],
    ['Produtos relacionados', 'Productos relacionados'],
    ['Ver categoria completa', 'Ver categoría completa'],
    ['Outras opções que podem interessar', 'Otras opciones que pueden interesarle'],
    ['Uma seleção rápida de produtos para explorar formatos diferentes sem voltar ao catálogo inteiro.', 'Una selección rápida de productos para explorar formatos diferentes sin volver al catálogo completo.'],
    ['Preço base', 'Precio base'],
    ['Personalizar produto', 'Personalizar producto'],
    ['Escolha as opções, envie o design e finalize a encomenda no passo seguinte.', 'Elija las opciones, envíe el diseño y finalice el pedido en el siguiente paso.'],
    ['Pedir apoio', 'Solicitar ayuda'],
    ['Escolher outro produto', 'Elegir otro producto'],
    ['Escolha o reforço', 'Elija el refuerzo'],
    ['Selecione a opção pretendida antes de continuar.', 'Seleccione la opción deseada antes de continuar.'],
    ['Mapa do site', 'Mapa del sitio'],
    ['Páginas principais', 'Páginas principales'],
    ['Categorias', 'Categorías'],
    ['Paginas principais', 'Páginas principales'],
    ['Página', 'Página'],
    ['Página de contacto', 'Página de contacto'],
    ['Loja 100% online', 'Tienda 100% online'],
    ['Atendimento 24h', 'Atención 24 h'],
    ['Atendimento online 24h', 'Atención online 24 h'],
    ['Envie-nos', 'Envíenos'],
    ['Escreva', 'Escriba'],
    ['Selecione', 'Seleccione'],
    ['Escolha', 'Elija'],
    ['Os seus', 'Sus'],
    ['sua', 'su'],
    ['seu', 'su'],
    ['já esteja aqui', 'ya esté aquí'],
    ['para ajudar', 'para ayudar'],
    ['perguntas frequentes', 'preguntas frecuentes']
]).concat(EXTRA_TEXT_REPLACEMENTS).slice().sort((left, right) => String(right[0] || '').length - String(left[0] || '').length);
const PRODUCT_TRANSLATIONS = (() => {
    const merged = { ...(ES_CATALOG.products || {}) };
    (Array.isArray(GENERATED_MANIFEST.products) ? GENERATED_MANIFEST.products : []).forEach((product) => {
        if (!product?.slug) return;
        merged[product.slug] = {
            ...(merged[product.slug] || {}),
            ...(product.nomeEs ? { name: product.nomeEs } : {}),
            ...(product.descricaoEs ? { description: product.descricaoEs } : {})
        };
    });
    return merged;
})();
const CATEGORY_TRANSLATIONS = ES_CATALOG.categories || {};

const ATTRIBUTE_TRANSLATIONS = {
    alt: true,
    title: true,
    placeholder: true,
    'aria-label': true,
    'aria-labelledby': true,
    content: true,
    item: true,
    'data-name': true,
    'data-product-name': true
};

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translateText(value) {
    const raw = String(value || '');
    if (!raw.trim()) {
        return raw;
    }

    const leading = raw.match(/^\s*/)?.[0] || '';
    const trailing = raw.match(/\s*$/)?.[0] || '';
    let output = raw.trim().replace(/\s+/g, ' ');
    for (const [source, target] of TEXT_REPLACEMENTS) {
        output = output.replace(new RegExp(escapeRegExp(source), 'g'), target);
    }
    return `${leading}${output}${trailing}`;
}

function splitUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return { path: '', suffix: '', isAbsolute: false };

    const absoluteMatch = raw.match(new RegExp(`^${escapeRegExp(CANONICAL_ORIGIN)}(?<path>\\/[^?#]*)(?<suffix>[?#].*)?$`));
    if (absoluteMatch?.groups) {
        return {
            path: absoluteMatch.groups.path || '/',
            suffix: absoluteMatch.groups.suffix || '',
            isAbsolute: true
        };
    }

    const relativeMatch = raw.match(/^(?<path>\/[^?#]*)(?<suffix>[?#].*)?$/);
    if (relativeMatch?.groups) {
        return {
            path: relativeMatch.groups.path || '/',
            suffix: relativeMatch.groups.suffix || '',
            isAbsolute: false
        };
    }

    return { path: '', suffix: '', isAbsolute: false };
}

function localizeUrlValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    if (/^(mailto:|tel:|javascript:|#)/i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw) && !raw.startsWith(CANONICAL_ORIGIN)) return raw;
    const { path: pathname, suffix, isAbsolute } = splitUrl(raw);
    if (!pathname) return raw;
    if (/^\/assets\//i.test(pathname) || /^\/favicon/i.test(pathname) || /^\/apple-touch-icon/i.test(pathname) || /^\/api\//i.test(pathname) || /^\/sitemaps\//i.test(pathname) || /^\/robots\.txt$/i.test(pathname) || /^\/sitemap\.xml$/i.test(pathname)) {
        return raw;
    }
    const localizedPath = SiteRoutes.getLocalizedPath(pathname, 'es');
    if (isAbsolute) {
        return `${CANONICAL_ORIGIN}${localizedPath}${suffix}`;
    }

    return `${localizedPath}${suffix}`;
}

function localizeTextContent(value) {
    if (String(value || '').trim() === '/') {
        return value;
    }

    const localizedUrl = localizeUrlValue(value);
    if (localizedUrl !== value) {
        return localizedUrl;
    }

    return translateText(value);
}

function localizeJsonLd(text) {
    const raw = String(text || '').trim();
    if (!raw) return raw;

    try {
        const parsed = JSON.parse(raw);
        const visit = (value) => {
            if (Array.isArray(value)) {
                return value.map(visit);
            }

            if (value && typeof value === 'object') {
                return Object.fromEntries(Object.entries(value).map(([key, nextValue]) => [key, visit(nextValue)]));
            }

            if (typeof value === 'string') {
                return localizeTextContent(value);
            }

            return value;
        };

        return JSON.stringify(visit(parsed), null, 2);
    } catch {
        return translateText(raw);
    }
}

function localizeAttributeValue(name, value) {
    if (!ATTRIBUTE_TRANSLATIONS[name]) {
        return value;
    }

    return localizeTextContent(value);
}

function addAlternateLinks($, canonicalPath) {
    const canonical = SiteRoutes.buildPublicUrl(canonicalPath);
    const localized = SiteRoutes.buildPublicUrl(SiteRoutes.getLocalizedPath(canonicalPath, 'es'));
    $('link[rel="alternate"]').remove();
    const alternatePt = `<link rel="alternate" hreflang="pt-PT" href="${canonical}">`;
    const alternateEs = `<link rel="alternate" hreflang="es-ES" href="${localized}">`;
    const alternateDefault = `<link rel="alternate" hreflang="x-default" href="${canonical}">`;

    const canonicalLink = $('link[rel="canonical"]').first();
    if (canonicalLink.length > 0) {
        canonicalLink.after(`\n  ${alternatePt}\n  ${alternateEs}\n  ${alternateDefault}`);
        return;
    }

    $('head').append(`\n  ${alternatePt}\n  ${alternateEs}\n  ${alternateDefault}`);
}

function catalogSlugFromCanonical(canonicalPath, prefix) {
    const match = String(canonicalPath || '').match(new RegExp(`^/${prefix}/([^/]+)$`, 'i'));
    return match ? decodeURIComponent(match[1]) : '';
}

function catalogSlugFromHref(value, prefix) {
    const { path: pathname } = splitUrl(value);
    const match = String(pathname || '').match(new RegExp(`^/(?:es/)?${prefix}/([^/]+)$`, 'i'));
    return match ? decodeURIComponent(match[1]) : '';
}

function productTranslationForPath(canonicalPath) {
    const slug = catalogSlugFromCanonical(canonicalPath, 'produto');
    return slug ? PRODUCT_TRANSLATIONS[slug] || null : null;
}

function categoryTranslationForPath(canonicalPath) {
    const slug = catalogSlugFromCanonical(canonicalPath, 'produtos');
    return slug ? CATEGORY_TRANSLATIONS[slug] || null : null;
}

function updateMeta($, selector, value) {
    if (!value) return;
    const node = $(selector).first();
    if (node.length > 0) {
        node.attr('content', value);
    }
}

function applyStaticSeoOverride($, canonicalPath) {
    const override = STATIC_SEO_OVERRIDES_ES[canonicalPath];
    if (!override) return;

    $('title').text(override.title);
    updateMeta($, 'meta[name="description"]', override.description);
    updateMeta($, 'meta[property="og:title"]', override.title);
    updateMeta($, 'meta[property="og:description"]', override.description);
    updateMeta($, 'meta[name="twitter:title"]', override.title);
    updateMeta($, 'meta[name="twitter:description"]', override.description);

    $('script[type="application/ld+json"]').each((_, element) => {
        const node = $(element);
        const raw = String(node.text() || '').trim();
        if (!raw) return;

        try {
            const data = JSON.parse(raw);
            if (data && typeof data === 'object') {
                data.name = override.title;
                data.description = override.description;
                node.text(JSON.stringify(data, null, 2));
            }
        } catch {
            // Leave invalid or non-object JSON-LD untouched.
        }
    });
}

function updateJsonLdForCatalog($, productTranslation, categoryTranslation) {
    $('script[type="application/ld+json"]').each((_, element) => {
        const node = $(element);
        const raw = String(node.text() || '').trim();
        if (!raw) return;

        try {
            const data = JSON.parse(raw);
            const visit = (value) => {
                if (Array.isArray(value)) return value.map(visit);
                if (!value || typeof value !== 'object') return value;

                const next = { ...value };
                if (next['@type'] === 'Product' && productTranslation) {
                    next.name = productTranslation.name || next.name;
                    next.description = productTranslation.description || next.description;
                }

                if (next['@type'] === 'ListItem') {
                    if (productTranslation && next.name && PRODUCT_TRANSLATIONS[SiteRoutes.slugify(next.name)]?.name) {
                        next.name = PRODUCT_TRANSLATIONS[SiteRoutes.slugify(next.name)].name;
                    } else if (categoryTranslation && next.position === 3) {
                        next.name = categoryTranslation.label || next.name;
                    }
                }

                return Object.fromEntries(Object.entries(next).map(([key, nestedValue]) => [key, visit(nestedValue)]));
            };

            node.text(JSON.stringify(visit(data), null, 2));
        } catch {
            // JSON-LD was already handled by the generic text translator.
        }
    });
}

function replaceSupportSubject(href, localizedName) {
    const raw = String(href || '').trim();
    if (!raw || !localizedName) return href;

    const [base, query = ''] = raw.split('?');
    const params = new URLSearchParams(query);
    if (!params.has('assunto')) {
        return href;
    }

    params.set('assunto', localizedName);
    const nextQuery = params.toString();
    return nextQuery ? `${base}?${nextQuery}` : base;
}

function localizeProductCards($) {
    $('article').each((_, element) => {
        const card = $(element);
        const primaryLink = card.find('a[href*="/produto/"]').first();
        if (primaryLink.length === 0) return;

        const translation = PRODUCT_TRANSLATIONS[catalogSlugFromHref(primaryLink.attr('href'), 'produto')];
        if (!translation) return;

        const localizedName = String(translation.name || '').trim();
        const localizedDescription = String(translation.description || '').trim();

        if (card.attr('data-name') && localizedName) {
            card.attr('data-name', localizedName.toLowerCase());
        }

        if (localizedName) {
            const image = card.find('img[alt]').first();
            if (image.length > 0) {
                image.attr('alt', localizedName);
            }

            const titleLink = card.find('h2 a, h3 a').first();
            if (titleLink.length > 0) {
                titleLink.text(localizedName);
            }

            card.find('a[data-product-name]').each((__, linkElement) => {
                $(linkElement).attr('data-product-name', localizedName);
            });
        }

        if (localizedDescription) {
            const descriptionNode = card.find('p.text-slate-600').first();
            if (descriptionNode.length > 0) {
                descriptionNode.text(localizedDescription);
            }
        }
    });
}

function applyCatalogTranslations($, canonicalPath) {
    const productTranslation = productTranslationForPath(canonicalPath);
    const categoryTranslation = categoryTranslationForPath(canonicalPath);

    if (productTranslation) {
        const title = productTranslation.seoTitle || productTranslation.name;
        const description = productTranslation.seoDescription || productTranslation.description;
        $('title').text(title);
        updateMeta($, 'meta[name="description"]', description);
        updateMeta($, 'meta[property="og:title"]', title);
        updateMeta($, 'meta[property="og:description"]', description);
        updateMeta($, 'meta[name="twitter:title"]', title);
        updateMeta($, 'meta[name="twitter:description"]', description);
        $('body').attr('data-product-name', productTranslation.name);
        $('h1').first().text(productTranslation.name);
        $('a[data-personalize-link]').attr('data-product-name', productTranslation.name);

        const detailParagraph = $('p').filter((_, element) => {
            const className = $(element).attr('class') || '';
            return className.includes('text-[0.95rem]') && className.includes('leading-7') && className.includes('text-slate-600');
        }).first();
        if (detailParagraph.length > 0 && productTranslation.description) {
            detailParagraph.text(productTranslation.description);
        }

        const supportLink = $('.product-quick-links a[href*="/contacto"]').first();
        if (supportLink.length > 0) {
            supportLink.attr('href', replaceSupportSubject(supportLink.attr('href'), productTranslation.name));
        }

        const relatedHeading = $('h2').filter((_, element) => $(element).text().trim() === 'Productos relacionados').first();
        if (relatedHeading.length > 0) {
            const relatedEyebrow = relatedHeading.prevAll('p').first();
            const relatedSummary = relatedHeading.nextAll('p').first();
            const categoryLabel = $('.product-breadcrumb a[href*="/produtos/"]').last().text().trim()
                || categoryTranslation?.label
                || 'producto';
            if (relatedEyebrow.length > 0) {
                relatedEyebrow.text('Siga explorando');
            }
            if (relatedSummary.length > 0) {
                relatedSummary.text(`Vea más modelos de la categoría ${(categoryTranslation?.label || translateText('Bandeiras')).trim()} y compare formatos, tamaños y precios.`);
            }
            if (relatedSummary.length > 0) {
                relatedSummary.text(`Vea más modelos de la categoría ${categoryLabel} y compare formatos, tamaños y precios.`);
            }
        }

        $('img[alt]').each((_, element) => {
            const node = $(element);
            const value = node.attr('alt') || '';
            if (value && value !== 'IberFlag') {
                node.attr('alt', translateText(value));
            }
        });
    }

    if (categoryTranslation) {
        const categoryTitle = `${categoryTranslation.label} personalizados | IberFlag`;
        const description = categoryTranslation.description;
        $('title').text(categoryTitle);
        updateMeta($, 'meta[name="description"]', description);
        updateMeta($, 'meta[property="og:title"]', categoryTitle);
        updateMeta($, 'meta[property="og:description"]', description);
        updateMeta($, 'meta[name="twitter:title"]', categoryTitle);
        updateMeta($, 'meta[name="twitter:description"]', description);
        $('h1').first().text(categoryTranslation.label);

        const leadParagraph = $('h1').first().nextAll('p').first();
        if (leadParagraph.length > 0 && description) {
            leadParagraph.text(description);
        }
    }

    localizeProductCards($);
    updateJsonLdForCatalog($, productTranslation, categoryTranslation);
}

function localizeInlineScripts($) {
    $('script:not([src]):not([type="application/ld+json"])').each((_, element) => {
        const node = $(element);
        const text = node.text();
        if (!text) return;
        node.text(text
            .replace(/(['"])\/produtos\1/g, '$1/es/produtos$1')
            .replace(/(['"])\/checkout\1/g, '$1/es/checkout$1')
            .replace(/(['"])\/encomendas\1/g, '$1/es/encomendas$1')
            .replace(/(['"])\/contacto\1/g, '$1/es/contacto$1')
            .replace(/(['"])\/produto\//g, '$1/es/produto/'));
    });
}

function injectI18nScript($) {
    if ($('script[src*="/assets/js/core/site-routes.js"]').length === 0) {
        const siteRoutesTag = '<script src="/assets/js/core/site-routes.js?v=20260409seo1"></script>';
        const logicScript = $('script[src*="/assets/js/core/logic.js"]').first();
        if (logicScript.length > 0) {
            logicScript.before(`\n  ${siteRoutesTag}`);
        } else {
            $('head').append(`\n  ${siteRoutesTag}`);
        }
    }

    if ($('script[src^="/assets/js/core/i18n.js"]').length > 0) return;

    const scriptTag = '<script src="/assets/js/core/i18n.js?v=20260422a"></script>';
    const siteRoutesScript = $('script[src*="/assets/js/core/site-routes.js"]').first();
    if (siteRoutesScript.length > 0) {
        siteRoutesScript.after(`\n  ${scriptTag}`);
        return;
    }

    const logicScript = $('script[src*="/assets/js/core/logic.js"]').first();
    if (logicScript.length > 0) {
        logicScript.before(`\n  ${scriptTag}`);
        return;
    }

    $('head').append(`\n  ${scriptTag}`);
}

function applyHtmlFallbackTranslations(html) {
    return String(html || '')
        .replace(/(\d+)\s+produtos/g, '$1 productos')
        .replace(/(\d+)\s+produto(?!s)/g, '$1 producto')
        .replace(/IVA calculado no checkout/g, 'IVA calculado en el checkout')
        .replace(/Personalização incluída/g, 'Personalización incluida')
        .replace(/(\d+)\s+itens incluídos/g, '$1 artículos incluidos')
        .replace(/(\d+)\s+passos/g, '$1 pasos')
        .replace(/Publicidade física/g, 'Publicidad física')
        .replace(/tratada como marca\./g, 'tratada como marca.')
        .replace(/Flybanners, roll-ups e formatos promocionais com direção visual premium, operação rápida e\s+presença forte no momento em que o cliente entra no espaço\./g, 'Fly banners, roll ups y formatos promocionales con dirección visual premium, operación rápida y presencia fuerte cuando el cliente entra en el espacio.')
        .replace(/Ver Catálogo/g, 'Ver catálogo')
        .replace(/Ver Todos os Produtos/g, 'Ver todos los productos')
        .replace(/Falar com Consultor/g, 'Hablar con un asesor')
        .replace(/Ferramentas/g, 'Herramientas')
        .replace(/Nova marca/g, 'Nueva marca')
        .replace(/crescimento com cada projeto/g, 'crecimiento con cada proyecto')
        .replace(/produção standard/g, 'producción estándar')
        .replace(/Apoio direto/g, 'Atención directa')
        .replace(/equipa comercial dedicada/g, 'equipo comercial dedicado')
        .replace(/Dirección visul/g, 'Dirección visual')
        .replace(/Leitura imediata para montra, rua e evento\./g, 'Lectura inmediata para escaparate, calle y evento.')
        .replace(/Mensagem vertical, elegante e portátil\./g, 'Mensaje vertical, elegante y portátil.')
        .replace(/Escala, resistência e visibilidade exterior\./g, 'Escala, resistencia y visibilidad exterior.')
        .replace(/Ver coleção/g, 'Ver colección')
        .replace(/Ver Modelos/g, 'Ver modelos')
        .replace(/Não encontra o que procura\?/g, '¿No encuentra lo que busca?')
        .replace(/Envíenos o que precisa e a equipa responde com proposta personalizada, prazo e melhor solução para su caso\./g, 'Envíenos lo que necesita y el equipo responderá con una propuesta personalizada, plazo y la mejor solución para su caso.')
        .replace(/Resposta comercial rápida/g, 'Respuesta comercial rápida')
        .replace(/O su nome/g, 'Su nombre')
        .replace(/Ex\.: Fly banner para feira/g, 'Ej.: Fly banner para feria')
        .replace(/Descreva o formato, quantidades e prazo pretendido/g, 'Describa el formato, las cantidades y el plazo deseado')
        .replace(/Enviar Pedido/g, 'Enviar solicitud')
        .replace(/Enviar Email/g, 'Enviar email')
        .replace(/Todos os direitos reservados\./g, 'Todos los derechos reservados.')
        .replace(/Consultar encomenda/g, 'Consultar pedido')
        .replace(/A confirmar o pagamento e a preparar o tracking dsu encomenda IberFlag\./g, 'Confirmando el pago y preparando el seguimiento de su pedido IberFlag.')
        .replace(/A confirmar o pagamento e a preparar su encomenda\./g, 'Confirmando el pago y preparando su pedido.')
        .replace(/Pago em processamento/g, 'Pago en procesamiento')
        .replace(/Estamos a validar a sua encomenda\. Em breve abrimos o tracking\./g, 'Estamos validando su pedido. En breve abriremos el seguimiento.')
        .replace(/Voltar aos produtos/g, 'Volver a los productos')
        .replace(/Nova pesquisa/g, 'Nueva búsqueda')
        .replace(/A carregar encomenda\.\.\./g, 'Cargando pedido...')
        .replace(/Voltar ao tracking/g, 'Volver al seguimiento')
        .replace(/Erro ao carregar a encomenda/g, 'Error al cargar el pedido')
        .replace(/Erro al carregar a pedido/g, 'Error al cargar el pedido')
        .replace(/Ocorreu um problema ao carregar a encomenda\./g, 'Se ha producido un problema al cargar el pedido.')
        .replace(/Cortar Imagem/g, 'Recortar imagen')
        .replace(/Tamanho:/g, 'Tamaño:')
        .replace(/Espessura:/g, 'Grosor:')
        .replace(/Rev\u00ea o resultado final para garantir que est\u00e1 tudo correto\./g, 'Revise el resultado final para asegurarse de que todo está correcto.')
        .replace(/Rota\u00e7\u00e3o:/g, 'Rotación:');
}

function translateDom($) {
    const sourceCanonical = currentCanonicalPath($);
    $('html').attr('lang', 'es-ES');
    $('meta[property="og:locale"]').attr('content', 'es_ES');
    $('link[rel="alternate"]').remove();

    $('script[type="application/ld+json"]').each((_, element) => {
        const node = $(element);
        node.text(localizeJsonLd(node.text()));
    });

    $('[href], [src], [action]').each((_, element) => {
        const node = $(element);
        for (const attribute of ['href', 'src', 'action']) {
            const currentValue = node.attr(attribute);
            if (currentValue) {
                node.attr(attribute, localizeUrlValue(currentValue));
            }
        }
    });

    $('[content], [item]').each((_, element) => {
        const node = $(element);
        for (const attribute of ['content', 'item']) {
            const currentValue = node.attr(attribute);
            if (!currentValue) continue;

            const localizedValue = localizeUrlValue(currentValue);
            node.attr(attribute, localizedValue !== currentValue ? localizedValue : translateText(currentValue));
        }
    });

    for (const attribute of Object.keys(ATTRIBUTE_TRANSLATIONS)) {
        if (attribute === 'content' || attribute === 'item') continue;
        const selector = `[${attribute}]`;
        $(selector).each((_, element) => {
            const node = $(element);
            const currentValue = node.attr(attribute);
            if (currentValue) {
                node.attr(attribute, localizeAttributeValue(attribute, currentValue));
            }
        });
    }

    const walk = (element) => {
        if (!element || !element.children) return;

        element.children.forEach((child) => {
            if (child.type === 'text') {
                const nextValue = localizeTextContent(child.data);
                if (nextValue !== child.data) {
                    child.data = nextValue;
                }
                return;
            }

            if (child.type === 'tag' && !['script', 'style', 'noscript'].includes(String(child.name || '').toLowerCase())) {
                walk(child);
            }
        });
    };

    walk($.root()[0]);
    applyCatalogTranslations($, sourceCanonical);
    localizeInlineScripts($);
    injectI18nScript($);
    addAlternateLinks($, sourceCanonical);
    return $;
}

function currentCanonicalPath($) {
    const canonicalHref = $('link[rel="canonical"]').attr('href') || `${CANONICAL_ORIGIN}/`;
    const normalized = canonicalHref.startsWith(CANONICAL_ORIGIN)
        ? canonicalHref.slice(CANONICAL_ORIGIN.length)
        : canonicalHref;
    return normalized || '/';
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function writeFile(targetPath, content) {
    await ensureDir(path.dirname(targetPath));
    const normalizedContent = String(content || '')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n');
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await fs.writeFile(targetPath, normalizedContent, 'utf8');
            return;
        } catch (error) {
            if (!['EBUSY', 'EPERM', 'EACCES'].includes(error?.code) || attempt === maxAttempts) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        }
    }
}

async function removeGeneratedPath(targetPath) {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await fs.rm(targetPath, { recursive: true, force: true });
            return;
        } catch (error) {
            if (!['EBUSY', 'EPERM', 'EACCES'].includes(error?.code) || attempt === maxAttempts) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, attempt * 300));
        }
    }
}

function staticTargetPath(sourceFileName) {
    const route = STATIC_PAGE_ROUTES[sourceFileName];
    if (route === undefined) {
        return null;
    }

    return route ? path.join(OUTPUT_ROOT, route, 'index.html') : path.join(OUTPUT_ROOT, 'index.html');
}

function sourceCanonicalPath(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/');
    if (normalized.startsWith('pages/')) {
        const fileName = path.basename(normalized);
        const route = STATIC_PAGE_ROUTES[fileName];
        if (route === undefined) {
            return null;
        }
        return route ? `/${route}` : '/';
    }

    if (normalized === 'produtos/index.html') {
        return '/produtos';
    }

    if (normalized.startsWith('produto/')) {
        const slug = normalized.split('/')[1];
        return `/produto/${slug}`;
    }

    if (normalized.startsWith('produtos/')) {
        const slug = normalized.split('/')[1];
        return `/produtos/${slug}`;
    }

    if (normalized.startsWith('mapa-do-site/')) {
        return '/mapa-do-site';
    }

    return null;
}

function applyCheckoutOverrides($) {
    const setText = (selector, text) => {
        const element = $(selector).first();
        if (element.length > 0) {
            element.text(text);
        }
    };
    const setPanelKicker = (step, number, label) => {
        const element = $(`[data-checkout-panel="${step}"] .checkout-panel-kicker`).first();
        if (element.length > 0) {
            element.html(`<span class="checkout-step-badge">${number}</span>${label}`);
        }
    };
    const setButtonHtml = (selector, text, icon, iconSide = 'right') => {
        const element = $(selector).first();
        if (element.length === 0) return;
        const iconHtml = `<i data-lucide="${icon}" class="w-4 h-4"></i>`;
        element.html(iconSide === 'left' ? `${iconHtml}${text}` : `${text}${iconHtml}`);
    };

    $('title').text('Finalizar pedido | IberFlag');
    $('meta[name="description"]').attr('content', 'Finaliza tu pedido IberFlag con pago online mediante Stripe, facturación validada y envío a la dirección indicada.');
    $('meta[property="og:title"], meta[name="twitter:title"]').attr('content', 'Finalizar pedido | IberFlag');
    $('meta[property="og:description"], meta[name="twitter:description"]').attr('content', 'Finaliza tu pedido IberFlag con pago online mediante Stripe, facturación validada y envío a la dirección indicada.');

    setText('h1', 'Finalizar pedido');
    $('.checkout-steps').attr('aria-label', 'Pasos del checkout');
    $('.checkout-step[data-checkout-step="details"] .checkout-step-number').text('1');
    $('.checkout-step[data-checkout-step="address"] .checkout-step-number').text('2');
    $('.checkout-step[data-checkout-step="payment"] .checkout-step-number').text('3');
    $('.checkout-step[data-checkout-step="details"] .checkout-step-text').text('Datos');
    $('.checkout-step[data-checkout-step="address"] .checkout-step-text').text('Dirección');
    $('.checkout-step[data-checkout-step="payment"] .checkout-step-text').text('Pago');

    setPanelKicker('details', '1', 'Datos');
    setText('[data-checkout-panel="details"] .app-section-title', 'Contacto y facturación');
    setText('[data-checkout-panel="details"] .app-section-subtitle', 'Datos mínimos para identificar el pedido y preparar el pago.');

    setPanelKicker('address', '2', 'Dirección');
    setText('[data-checkout-panel="address"] .app-section-title', 'Entrega y facturación');
    setText('[data-checkout-panel="address"] .app-section-subtitle', 'Use una única dirección para simplificar el pedido.');

    setPanelKicker('payment', '3', 'Pago');
    setText('[data-checkout-panel="payment"] .app-section-title', 'Revisar y pagar');
    setText('[data-checkout-panel="payment"] .app-section-subtitle', 'El pago se abre aquí en la tienda con Stripe.');

    $('#customer-type-select option[value="particular"]').text('Particular');
    $('#customer-type-select option[value="empresa"]').text('Empresa');
    $('#country-select option[value="PT"], #address-country-select option[value="PT"]').text('Portugal');
    $('#country-select option[value="ES"], #address-country-select option[value="ES"]').text('España');
    $('#country-select, #address-country-select').val('ES');
    $('.checkout-phone-field').first().attr('data-phone-country', 'ES');
    $('#phone-country-toggle')
        .attr('aria-label', 'Usar indicativo de España, +34')
        .attr('title', 'Cambiar prefijo')
        .find('.checkout-phone-dial')
        .text('+34');
    $('input[name="telefone"]').attr('placeholder', '612 345 678');
    $('.checkout-tax-field').attr('data-tax-country', 'ES');
    $('#tax-country-toggle')
        .attr('aria-label', 'Usar NIF de España')
        .attr('title', 'Cambiar país fiscal')
        .find('.checkout-phone-dial')
        .text('ES');
    $('#nif-input').attr('placeholder', 'B12345678');
    $('#company-field-row input[name="empresa"]').attr('placeholder', 'Nombre fiscal de la empresa');
    $('#contact-name-label').text('Nombre completo *');
    $('#company-label').text('Empresa *');

    $('input[name="telefone"]').closest('div').find('label').first().text('Móvil / teléfono *');
    $('select[name="pais_entrega"]').closest('div').find('label').first().text('País de entrega *');
    $('input[name="codigo_postal"]').closest('div').find('label').first().text('Código postal *');
    $('#address-region-label').text('Provincia *');
    $('#address-municipality-label').text('Municipio *');
    $('#address-region-select option').first().text('Elija la provincia');
    $('#address-municipality-select option').first().text('Elija primero la provincia');
    $('input[name="morada"]').closest('div').find('label').first().text('Dirección *');
    $('input[name="cidade"]').closest('div').find('label').first().text('Ciudad *');
    $('#toggle-order-notes').text('Añadir nota al pedido');
    $('#order-notes-field label').text('Notas del pedido (opcional)');
    $('#order-notes-field textarea').attr('placeholder', 'Información adicional para el equipo.');

    $('.checkout-same-address strong').text('Usar esta dirección para entrega y facturación');
    $('.checkout-same-address small').text('No pedimos una segunda dirección.');
    setButtonHtml('[data-checkout-next="address"]', 'Continuar a dirección', 'arrow-right');
    setButtonHtml('[data-checkout-back="details"]', 'Volver', 'arrow-left', 'left');
    setButtonHtml('[data-checkout-next="payment"]', 'Revisar y pagar', 'arrow-right');
    setButtonHtml('[data-checkout-back="address"]', 'Volver', 'arrow-left', 'left');

    $('.checkout-payment-copy span').text('Tarjeta, MB Way y Multibanco aparecen según disponibilidad.');
    $('.checkout-payment-methods').attr('aria-label', 'Métodos de pago');
    $('.checkout-method-pill').eq(0).html('<i data-lucide="credit-card" class="w-4 h-4"></i>Tarjeta');
    $('.checkout-method-pill').eq(1).html('<i data-lucide="smartphone" class="w-4 h-4"></i>MB Way');
    $('.checkout-method-pill').eq(2).html('<i data-lucide="landmark" class="w-4 h-4"></i>Multibanco');
    $('#checkout-locked-note').text('Pago abierto. Para cambiar datos o carrito, actualice la página antes de crear una nueva sesión.');
    $('#checkout-embed-shell h3').text('Pago seguro');
    $('#checkout-embed-shell p.text-slate-600').first().text('Complete el pago abajo para confirmar el pedido.');
    $('#checkout-embed-loader span').text('Preparando el pago seguro...');

    $('#design-review-checkbox').closest('label').find('span').first().html('Añadir revisión de diseño por <strong>5€</strong>. <a href="/es/termos#responsabilidade-design" class="text-blue-600 hover:underline">Ver términos</a>.');
    $('#terms-checkbox').closest('label').find('span').first().html('He leído y acepto los <a href="/es/termos" class="text-blue-600 hover:underline">Términos y condiciones</a> y la <a href="/es/privacidade" class="text-blue-600 hover:underline">Política de privacidad</a>.');
    $('#place-order-btn').html('<i data-lucide="lock" class="w-5 h-5"></i> Abrir pago seguro');

    setText('.checkout-summary h2', 'Resumen del pedido');
    $('.checkout-summary .app-section-subtitle').first().text('Confirme productos, cantidades y total antes de pagar.');
    $('#design-review-row span').first().text('Revisión de diseño');
    $('#shipping').prev('span').text('Envío');
    $('#shipping').text('Gratis');
    $('.checkout-shipping-box p.font-semibold').text('Envío gratis');
    $('#free-shipping-msg').text('Envío gratis para Portugal y España, confirmado según la dirección de entrega.');
    $('.checkout-summary-note span').text('Pago seguro dentro de la tienda.');
}

function translateHtmlFile(html, sourceFileName) {
    const $ = cheerio.load(html, { decodeEntities: false });
    const sourceCanonical = currentCanonicalPath($);
    translateDom($);

    if (sourceFileName === 'index.html' && sourceCanonical === '/') {
        $('title').text('IberFlag - Fly banners y publicidad física personalizada');
    }

    if (sourceFileName === 'index.html' && sourceCanonical === '/produtos') {
        $('title').text('Catálogo de productos publicitarios | IberFlag');
        $('meta[name="description"]').attr('content', 'Explora el catálogo IberFlag con fly banners, roll ups, banderas, photocalls, carpas y soportes promocionales personalizados.');
        $('meta[property="og:title"]').attr('content', 'Catálogo de productos publicitarios | IberFlag');
        $('meta[property="og:description"]').attr('content', 'Explora el catálogo IberFlag con fly banners, roll ups, banderas, photocalls, carpas y soportes promocionales personalizados.');
        $('meta[name="twitter:title"]').attr('content', 'Catálogo de productos publicitarios | IberFlag');
        $('meta[name="twitter:description"]').attr('content', 'Explora el catálogo IberFlag con fly banners, roll ups, banderas, photocalls, carpas y soportes promocionales personalizados.');
        $('h1').first().text('Catálogo de productos publicitarios');
    }

    if (sourceCanonical === '/checkout') {
        applyCheckoutOverrides($);
    }

    applyStaticSeoOverride($, sourceCanonical);

    return applyHtmlFallbackTranslations($.html());
}

function translateSitemapXml(xml) {
    return xml
        .replace(/<loc>([^<]+)<\/loc>/g, (_, loc) => `<loc>${localizeUrlValue(loc)}</loc>`)
        .replace(/<lastmod>([^<]+)<\/lastmod>/g, (_, lastmod) => `<lastmod>${lastmod}</lastmod>`);
}

async function collectFiles(dir, predicate = () => true) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await collectFiles(fullPath, predicate));
            continue;
        }

        if (predicate(fullPath)) {
            files.push(fullPath);
        }
    }
    return files;
}

async function buildSpanishStaticPages() {
    const sourceFiles = [
        ...(await collectFiles(SOURCE_PAGES_DIR, (file) => file.endsWith('.html'))),
        ...(await collectFiles(SOURCE_PRODUCTS_DIR, (file) => file.endsWith('index.html'))),
        ...(await collectFiles(SOURCE_CATEGORIES_DIR, (file) => file.endsWith('index.html'))),
        ...(await collectFiles(SOURCE_SITEMAP_DIR, (file) => file.endsWith('index.html')))
    ];

    await removeGeneratedPath(OUTPUT_ROOT);
    await ensureDir(OUTPUT_ROOT);

    for (const sourcePath of sourceFiles) {
        const relative = path.relative(ROOT_DIR, sourcePath).replace(/\\/g, '/');
        const sourceHtml = await fs.readFile(sourcePath, 'utf8');
        const sourceCanonical = sourceCanonicalPath(relative);

        if (sourceCanonical) {
            const sourceDom = cheerio.load(sourceHtml, { decodeEntities: false });
            addAlternateLinks(sourceDom, sourceCanonical);
            const updatedSourceHtml = sourceDom.html();
            if (updatedSourceHtml && updatedSourceHtml !== sourceHtml) {
                await writeFile(sourcePath, updatedSourceHtml);
            }
        }

        const translatedHtml = translateHtmlFile(sourceHtml, path.basename(sourcePath));

        let targetPath = null;

        if (relative.startsWith('pages/')) {
            targetPath = staticTargetPath(path.basename(sourcePath));
        } else if (relative === 'produtos/index.html') {
            targetPath = path.join(OUTPUT_ROOT, 'produtos', 'index.html');
        } else if (relative.startsWith('produto/')) {
            const productSlug = relative.split('/')[1];
            targetPath = path.join(OUTPUT_ROOT, 'produto', productSlug, 'index.html');
        } else if (relative.startsWith('produtos/')) {
            const categorySlug = relative.split('/')[1];
            targetPath = path.join(OUTPUT_ROOT, 'produtos', categorySlug, 'index.html');
        } else if (relative.startsWith('mapa-do-site/')) {
            targetPath = path.join(OUTPUT_ROOT, 'mapa-do-site', 'index.html');
        }

        if (!targetPath) continue;

        await writeFile(targetPath, translatedHtml);
    }
}

async function buildSpanishSitemaps() {
    const sitemapFiles = [
        'pages.xml',
        'categories.xml',
        'products.xml'
    ];

    for (const fileName of sitemapFiles) {
        const sourcePath = path.join(SOURCE_SITEMAP_DIR, fileName);
        const targetPath = path.join(SOURCE_SITEMAP_DIR, `es-${fileName}`);
        const sourceXml = await fs.readFile(sourcePath, 'utf8');
        await writeFile(targetPath, translateSitemapXml(sourceXml));
    }

    const rootSitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
    const rootSitemap = await fs.readFile(rootSitemapPath, 'utf8');
    const rootWithoutSpanishEntries = rootSitemap.replace(/\n  <sitemap>\n    <loc>https:\/\/iberflag\.com\/sitemaps\/es-[\s\S]*?<\/sitemap>/g, '');
    const localizedIndexEntries = sitemapFiles.map((fileName) => `
  <sitemap>
    <loc>${CANONICAL_ORIGIN}/sitemaps/es-${fileName}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </sitemap>`).join('');

    const updatedRootSitemap = rootWithoutSpanishEntries.replace('</sitemapindex>', `${localizedIndexEntries}\n</sitemapindex>`);
    await writeFile(rootSitemapPath, updatedRootSitemap);
}

async function main() {
    await buildSpanishStaticPages();
    await buildSpanishSitemaps();
    console.log('Spanish site build complete.');
}

main().catch((error) => {
    console.error('Spanish site build failed:', error);
    process.exitCode = 1;
});
