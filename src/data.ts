export interface PracticeItem {
    id: string;
    word: string;
    answer: string;
    hint: string;
    options: string[];
}

const rawData = [
    "die#Wurst#sausage ", "das#Würstchen#sausage ", "das#Brot#bread ", "die#Butter#butter ", "das#Brötchen#bread roll ", 
    "das#Café#café ", "die#Currysoße#curry sauce ", "der#Durst#thirst ", "das#Ei#egg ", "das#Eis#ice ", "die#Erdbeere#strawberry ", 
    "der#Essig#vinegar ", "der#Fisch#fish ", "die#Gabel#fork ", "das#Getränk#drink ", "das#Glas#glass ", "das#Hähnchen#chicken ", 
    "der#Kellner#waiter ", "der#Hunger#hunger ", "der#Imbiss#snack ", "der#Kaffee#coffee ", "die#Traube#grape ", "die#Kartoffel#potato ", 
    "die#Kasse#cash desk ", "die#Kirsche#cherry ", "der#Kuchen#cake ", "die#Limonade#lemonade ", "der#Löffel#spoon ", 
    "das#Tagesgericht#set meal ", "das#Messer#knife ", "die#Milch#milk ", "das#Mineralwasser#mineral water ", "der#Nachtisch#dessert ", 
    "der#Orangensaft#orange juice ", "der#Pfeffer#pepper ", "die#Pommes#fries ", "die#Portion#portion ", "die#Kostprobe#taste ", 
    "der#Reis#rice ", "die#Rundreise#round trip ", "der#Saft#juice ", "die#Sahne#cream ", "der#Salat#salad ", "das#Salz#salt ", 
    "die#Schokolade#chocolate ", "der#Senf#mustard ", "die#Serviette#serviette ", "das#Spiegelei#fried egg ", 
    "das#Selterswasser#sparkling water ", "die#Suppe#soup ", "die#Tasse#cup ", "der#Becher#cup ", "der#Tee#tea ", "die#Platte#plate ", 
    "die#Torte#cake ", "der#Wein#wine ", "der#Zucker#sugar ", "die#Ananas#pineapple ", "der#Apfel#apple ", "der#Appetit#appetite ", 
    "die#Aprikose#apricot ", "die#Banane#banana ", "das#Steak#steak ", "das#Bier#beer ", "die#Birne#pear ", "der#Blumenkohl#cauliflower ", 
    "die#Bohne#bean ", "der#Duft#scent ", "das#Fett#fat ", "die#Passform#fit ", "das#Gemüse#vegetable ", "der#Hamburger#hamburger ", 
    "die#Hauptspeise#main dish ", "das#Kalbfleisch#veal ", "die#Mohrrübe#carrot ", "der#Käse#cheese ", "der#Kohl#cabbage ", 
    "das#Lebensmittel#food ", "die#Meeresfrüchte#seafood ", "das#Öl#oil ", "das#Omelett#omelette ", "der#Pfirsich#peach ", 
    "der#Champignon#mushroom ", "die#Pizza#pizza ", "das#Rezept#recipe ", "das#Rindfleisch#beef ", "die#Haut#skin ", "die#Schüssel#bowl ", 
    "die#Schale#bowl ", "der#Schinken#ham ", "das#Schweinefleisch#pork ", "die#Spaghetti#spaghetti ", "die#Spezialität#specialty ", 
    "die#Süßigkeit#sweet ", "die#Tomate#tomato ", "der#Vegetarier#vegetarian ", "die#Vegetarierin#vegetarian ", "der#Januar#January ", 
    "der#Februar#February ", "der#März#March ", "der#April#April ", "der#Mai#May ", "der#Juni#June ", "der#Juli#July ", 
    "der#August#August ", "der#September#September ", "der#Oktober#October ", "der#November#November ", "der#Dezember#December ", 
    "der#Frühling#Spring ", "der#Sommer#Summer ", "der#Herbst#Autumn ", "der#Winter#Winter ", "die#Fastenzeit#Lent ", 
    "der#Feiertag#holiday ", "das#Jahr#year ", "die#Jahreszeit#season ", "der#Monat#month ", "das#Neujahr#New Year ", "das#Ostern#Easter ", 
    "das#Weihnachten#Christmas ", "der#Rücken#back ", "das#Ohr#ear ", "die#Nase#nose ", "der#Mund#mouth ", "der#Körper#body ", 
    "der#Kopf#head ", "das#Knie#knee ", "die#Hand#hand ", "die#Kehle#throat ", "der#Rachen#throat ", "der#Fuß#foot ", "der#Finger#finger ", 
    "das#Fieber#fever ", "das#Bein#leg ", "der#Magen#stomach ", "der#Bauch#stomach ", "das#Auge#eye ", "der#Arm#arm ", 
    "der#Wellensittich#budgerigar ", "der#Vogel#bird ", "das#Tier#animal ", "das#Pferd#horse ", "das#Meerschweinchen#guinea pig ", 
    "die#Maus#mouse ", "die#Katze#cat ", "das#Kaninchen#rabbit ", "der#Hund#dog ", "der#Hamster#hamster ", "das#Schaf#sheep ", "die#Kuh#cow ", 
    "der#Apfelsaft#apple juice ", "der#Cappuccino#cappuccino ", "der#Champagner#champagne ", "der#Kakao#cocoa ", "der#Kirschsaft#cherry juice ", 
    "der#Sekt#sparkling wine ", "der#Tomatensaft#tomato juice ", "der#Traubensaft#grape juice ", "das#Badezimmer#bathroom ", 
    "der#Dachboden#garret ", "das#Esszimmer#dining room ", "das#Fenster#window ", "der#Flur#hall ", "das#Gästezimmer#guest room ", 
    "der#Keller#cellar ", "das#Kinderzimmer#child’s room ", "die#Küche#kitchen ", "das#Schlafzimmer#bedroom ", "die#Tür#door ", 
    "das#Wohnzimmer#living room ", "das#Zimmer#room ", "die#Kleidung#clothing, wear ", "der#Stoff#fabric, material ", "die#Mode#fashion ", 
    "der#Hut#hat ", "die#Mütze#cap ", "das#Halstuch#scarf ", "das#Hemd#shirt ", "der#Pullover#sweater ", "die#Bluse#blouse ", 
    "der#Gürtel#belt ", "die#Hose#(a pair of) trousers ", "der#Rock#skirt ", "der#Anzug#suit ", "die#Jacke#jacket ", "der#Mantel#coat ", 
    "die#Strickjacke#cardigan ", "der#Handschuh#glove ", "die#Handschuhe#gloves ", "die#Krawatte#tie ", "der#Strumpf#stocking ", 
    "der#Schuh#shoe ", "der#Stiefel#(high) boot ", "die#Familie#family ", "das#Baby#baby ", "der#Bruder#brother ", "der#Cousin#cousin ", 
    "das#Kind#child ", "die#Eltern#parents ", "der#Erwachsener#adult ", "der#Opa#grandpa/granddad ", "der#Nachname#surname ", 
    "der#Freund#friend ", "die#Freundschaft#friendship ", "der#Gast#guest ", "die#Gastfreundschaft#hospitality ", "die#Geburt#birth ", 
    "der#Geburtstag#birthday ", "der#Onkel#uncle ", "die#Bruderschaft#brotherhood ", "die#Schwester#sister ", "die#Großeltern#grandparents ", 
    "die#Großmutter#grandmother ", "der#Großvater#grandfather ", "die#Hausnummer#house number ", "der#Junge#boy ", "das#Mädchen#girl ", 
    "der#Mann#man ", "die#Mutter#mother ", "die#Mutti#mum ", "der#Name#name ", "die#Oma#granny ", "die#Tochter#daughter ", 
    "der#Schwager#brother-in-law ", "die#Schwägerin#sister-in-law ", "die#Schwiegermutter#mother-in-law ", "der#Schwiegervater#father-in-law ", 
    "der#Sohn#son ", "der#Stiefvater#stepfather ", "die#Stiefmutter#stepmother ", "die#Tante#aunt ", "der#Wohnort#place of residence ", 
    "der#Vater#father ", "der#Papa#dad ", "der#Vati#dad ", "der#Vorname#first name ", "der#Zwilling#twin ", "der#Federball#badminton ", 
    "das#Badminton#badminton ", "der#Basketball#basketball ", "der#Besuch#visit ", "die#Briefmarke#stamp ", "das#Buch#book ", 
    "der#CD-Spieler#CD player ", "der#Computer#computer ", "die#Disco#disco ", "das#Finale#final ", "der#Fan#fan ", "die#Fitness#fitness ", 
    "das#Foto#photo ", "der#Fotoapparat#camera ", "die#Freundin#girlfriend ", "der#Fußball#football ", "die#Gruppe#group ", 
    "die#Bewegung#movement ", "das#Hallenbad#indoor swimming pool ", "das#Hobby#hobby ", "das#Hockey#hockey ", "das#Instrument#instrument ", 
    "das#Werkzeug#tool ", "der#Jugendklub#youth club ", "die#Karte#card ", "die#Kassette#cassette ", "das#Kino#cinema ", "das#Klavier#piano ", 
    "die#Mannschaft#team ", "das#Mitglied#member ", "die#Musik#music ", "der#Park#park ", "der#Rollschuh#roller skate ", "das#Rugby#rugby ", 
    "das#Schwimmbad#swimming pool ", "das#Spiel#game ", "der#Spielplatz#playground ", "der#Sport#sport ", "das#Stadion#stadium ", 
    "die#Stadt#town ", "das#Tennis#tennis ", "das#Theater#theatre ", "das#Tischtennis#table tennis ", "der#Verein#club ", 
    "das#Videospiel#video game ", "der#Wettbewerb#competition ", "das#Wochenende#weekend ", "die#Zeitschrift#magazine ", 
    "das#Abenteuer#adventure ", "die#Anzeige#advertisement ", "der#Ausflug#trip ", "der#Ausweis#identity card ", 
    "der#Dokumentarfilm#documentary ", "der#Eingang#entrance ", "der#Auftritt#entrance ", "das#Eintrittsgeld#entrance fee ", 
    "der#Film#film ", "die#Freizeit#leisure ", "die#Vernunft#reason ", "der#Horrorfilm#horror movie ", "die#Auskunft#information desk ", 
    "der#Informationsschalter#information desk ", "die#Komödie#comedy ", "das#Konzert#concert ", "der#Krimi#crime film ", 
    "die#Liebesgeschichte#romance ", "das#Lied#song ", "die#Liste#list ", "die#Nachrichten#news ", "die#Nachricht#news ", "der#Pop#pop ", 
    "der#Belgier#Belgian ", "der#Engländer#English man ", "die#Engländerin#English woman ", "der#Franzose#French man ", 
    "die#Französin#French woman ", "der#Holländer#Dutch man ", "die#Holländerin#Dutch woman ", "der#Ire#Irish man ", "die#Irin#Irish woman ", 
    "das#Belgien#Belgium ", "das#England#England ", "das#Frankreich#France ", "das#Griechenland#Greece ", "die#Niederlande#the Netherlands ", 
    "das#Österreich#Austria ", "das#Portugal#Portugal ", "das#Schottland#Scotland ", "die#Schweiz#Switzerland ", "das#Spanien#Spain ", 
    "die#Türkei#Turkey ", "der#Artikel#article"
];

export function generateItems(): PracticeItem[] {
    return rawData.map((itemStr, index) => {
        const [answer, word, hint] = itemStr.split('#').map(s => s.trim());
        return {
            id: String(index),
            word,
            answer,
            hint,
            options: ["der", "die", "das"]
        };
    });
}

export function shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
