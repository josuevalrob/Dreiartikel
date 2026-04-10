export interface PracticeItem {
    id: string;
    word: string;
    answer: string;
    hint: string;
    options: string[];
    category: string;
}

// Format: "article#Word#hint"
// Categories are assigned by index ranges below
const rawData: [string, string][] = [
    // Food & Drink (0-89)
    ["die#Wurst#sausage", "Food & Drink"],
    ["das#Würstchen#sausage", "Food & Drink"],
    ["das#Brot#bread", "Food & Drink"],
    ["die#Butter#butter", "Food & Drink"],
    ["das#Brötchen#bread roll", "Food & Drink"],
    ["das#Café#café", "Food & Drink"],
    ["die#Currysoße#curry sauce", "Food & Drink"],
    ["der#Durst#thirst", "Food & Drink"],
    ["das#Ei#egg", "Food & Drink"],
    ["das#Eis#ice", "Food & Drink"],
    ["die#Erdbeere#strawberry", "Food & Drink"],
    ["der#Essig#vinegar", "Food & Drink"],
    ["der#Fisch#fish", "Food & Drink"],
    ["die#Gabel#fork", "Food & Drink"],
    ["das#Getränk#drink", "Food & Drink"],
    ["das#Glas#glass", "Food & Drink"],
    ["das#Hähnchen#chicken", "Food & Drink"],
    ["der#Kellner#waiter", "Food & Drink"],
    ["der#Hunger#hunger", "Food & Drink"],
    ["der#Imbiss#snack", "Food & Drink"],
    ["der#Kaffee#coffee", "Food & Drink"],
    ["die#Traube#grape", "Food & Drink"],
    ["die#Kartoffel#potato", "Food & Drink"],
    ["die#Kasse#cash desk", "Food & Drink"],
    ["die#Kirsche#cherry", "Food & Drink"],
    ["der#Kuchen#cake", "Food & Drink"],
    ["die#Limonade#lemonade", "Food & Drink"],
    ["der#Löffel#spoon", "Food & Drink"],
    ["das#Tagesgericht#set meal", "Food & Drink"],
    ["das#Messer#knife", "Food & Drink"],
    ["die#Milch#milk", "Food & Drink"],
    ["das#Mineralwasser#mineral water", "Food & Drink"],
    ["der#Nachtisch#dessert", "Food & Drink"],
    ["der#Orangensaft#orange juice", "Food & Drink"],
    ["der#Pfeffer#pepper", "Food & Drink"],
    ["die#Pommes#fries", "Food & Drink"],
    ["die#Portion#portion", "Food & Drink"],
    ["die#Kostprobe#taste", "Food & Drink"],
    ["der#Reis#rice", "Food & Drink"],
    ["die#Rundreise#round trip", "Food & Drink"],
    ["der#Saft#juice", "Food & Drink"],
    ["die#Sahne#cream", "Food & Drink"],
    ["der#Salat#salad", "Food & Drink"],
    ["das#Salz#salt", "Food & Drink"],
    ["die#Schokolade#chocolate", "Food & Drink"],
    ["der#Senf#mustard", "Food & Drink"],
    ["die#Serviette#serviette", "Food & Drink"],
    ["das#Spiegelei#fried egg", "Food & Drink"],
    ["das#Selterswasser#sparkling water", "Food & Drink"],
    ["die#Suppe#soup", "Food & Drink"],
    ["die#Tasse#cup", "Food & Drink"],
    ["der#Becher#cup", "Food & Drink"],
    ["der#Tee#tea", "Food & Drink"],
    ["die#Platte#plate", "Food & Drink"],
    ["die#Torte#cake", "Food & Drink"],
    ["der#Wein#wine", "Food & Drink"],
    ["der#Zucker#sugar", "Food & Drink"],
    ["die#Ananas#pineapple", "Food & Drink"],
    ["der#Apfel#apple", "Food & Drink"],
    ["der#Appetit#appetite", "Food & Drink"],
    ["die#Aprikose#apricot", "Food & Drink"],
    ["die#Banane#banana", "Food & Drink"],
    ["das#Steak#steak", "Food & Drink"],
    ["das#Bier#beer", "Food & Drink"],
    ["die#Birne#pear", "Food & Drink"],
    ["der#Blumenkohl#cauliflower", "Food & Drink"],
    ["die#Bohne#bean", "Food & Drink"],
    ["der#Duft#scent", "Food & Drink"],
    ["das#Fett#fat", "Food & Drink"],
    ["die#Passform#fit", "Food & Drink"],
    ["das#Gemüse#vegetable", "Food & Drink"],
    ["der#Hamburger#hamburger", "Food & Drink"],
    ["die#Hauptspeise#main dish", "Food & Drink"],
    ["das#Kalbfleisch#veal", "Food & Drink"],
    ["die#Mohrrübe#carrot", "Food & Drink"],
    ["der#Käse#cheese", "Food & Drink"],
    ["der#Kohl#cabbage", "Food & Drink"],
    ["das#Lebensmittel#food", "Food & Drink"],
    ["die#Meeresfrüchte#seafood", "Food & Drink"],
    ["das#Öl#oil", "Food & Drink"],
    ["das#Omelett#omelette", "Food & Drink"],
    ["der#Pfirsich#peach", "Food & Drink"],
    ["der#Champignon#mushroom", "Food & Drink"],
    ["die#Pizza#pizza", "Food & Drink"],
    ["das#Rezept#recipe", "Food & Drink"],
    ["das#Rindfleisch#beef", "Food & Drink"],
    ["die#Haut#skin", "Food & Drink"],
    ["die#Schüssel#bowl", "Food & Drink"],
    ["die#Schale#bowl", "Food & Drink"],
    ["der#Schinken#ham", "Food & Drink"],
    ["das#Schweinefleisch#pork", "Food & Drink"],
    ["die#Spaghetti#spaghetti", "Food & Drink"],
    ["die#Spezialität#specialty", "Food & Drink"],
    ["die#Süßigkeit#sweet", "Food & Drink"],
    ["die#Tomate#tomato", "Food & Drink"],
    ["der#Vegetarier#vegetarian", "Food & Drink"],
    ["die#Vegetarierin#vegetarian", "Food & Drink"],

    // Calendar & Seasons
    ["der#Januar#January", "Calendar"],
    ["der#Februar#February", "Calendar"],
    ["der#März#March", "Calendar"],
    ["der#April#April", "Calendar"],
    ["der#Mai#May", "Calendar"],
    ["der#Juni#June", "Calendar"],
    ["der#Juli#July", "Calendar"],
    ["der#August#August", "Calendar"],
    ["der#September#September", "Calendar"],
    ["der#Oktober#October", "Calendar"],
    ["der#November#November", "Calendar"],
    ["der#Dezember#December", "Calendar"],
    ["der#Frühling#Spring", "Calendar"],
    ["der#Sommer#Summer", "Calendar"],
    ["der#Herbst#Autumn", "Calendar"],
    ["der#Winter#Winter", "Calendar"],
    ["die#Fastenzeit#Lent", "Calendar"],
    ["der#Feiertag#holiday", "Calendar"],
    ["das#Jahr#year", "Calendar"],
    ["die#Jahreszeit#season", "Calendar"],
    ["der#Monat#month", "Calendar"],
    ["das#Neujahr#New Year", "Calendar"],
    ["das#Ostern#Easter", "Calendar"],
    ["das#Weihnachten#Christmas", "Calendar"],

    // Body
    ["der#Rücken#back", "Body"],
    ["das#Ohr#ear", "Body"],
    ["die#Nase#nose", "Body"],
    ["der#Mund#mouth", "Body"],
    ["der#Körper#body", "Body"],
    ["der#Kopf#head", "Body"],
    ["das#Knie#knee", "Body"],
    ["die#Hand#hand", "Body"],
    ["die#Kehle#throat", "Body"],
    ["der#Rachen#throat", "Body"],
    ["der#Fuß#foot", "Body"],
    ["der#Finger#finger", "Body"],
    ["das#Fieber#fever", "Body"],
    ["das#Bein#leg", "Body"],
    ["der#Magen#stomach", "Body"],
    ["der#Bauch#stomach", "Body"],
    ["das#Auge#eye", "Body"],
    ["der#Arm#arm", "Body"],

    // Animals
    ["der#Wellensittich#budgerigar", "Animals"],
    ["der#Vogel#bird", "Animals"],
    ["das#Tier#animal", "Animals"],
    ["das#Pferd#horse", "Animals"],
    ["das#Meerschweinchen#guinea pig", "Animals"],
    ["die#Maus#mouse", "Animals"],
    ["die#Katze#cat", "Animals"],
    ["das#Kaninchen#rabbit", "Animals"],
    ["der#Hund#dog", "Animals"],
    ["der#Hamster#hamster", "Animals"],
    ["das#Schaf#sheep", "Animals"],
    ["die#Kuh#cow", "Animals"],

    // Beverages
    ["der#Apfelsaft#apple juice", "Beverages"],
    ["der#Cappuccino#cappuccino", "Beverages"],
    ["der#Champagner#champagne", "Beverages"],
    ["der#Kakao#cocoa", "Beverages"],
    ["der#Kirschsaft#cherry juice", "Beverages"],
    ["der#Sekt#sparkling wine", "Beverages"],
    ["der#Tomatensaft#tomato juice", "Beverages"],
    ["der#Traubensaft#grape juice", "Beverages"],

    // House & Rooms
    ["das#Badezimmer#bathroom", "House"],
    ["der#Dachboden#garret", "House"],
    ["das#Esszimmer#dining room", "House"],
    ["das#Fenster#window", "House"],
    ["der#Flur#hall", "House"],
    ["das#Gästezimmer#guest room", "House"],
    ["der#Keller#cellar", "House"],
    ["das#Kinderzimmer#child's room", "House"],
    ["die#Küche#kitchen", "House"],
    ["das#Schlafzimmer#bedroom", "House"],
    ["die#Tür#door", "House"],
    ["das#Wohnzimmer#living room", "House"],
    ["das#Zimmer#room", "House"],

    // Clothing
    ["die#Kleidung#clothing, wear", "Clothing"],
    ["der#Stoff#fabric, material", "Clothing"],
    ["die#Mode#fashion", "Clothing"],
    ["der#Hut#hat", "Clothing"],
    ["die#Mütze#cap", "Clothing"],
    ["das#Halstuch#scarf", "Clothing"],
    ["das#Hemd#shirt", "Clothing"],
    ["der#Pullover#sweater", "Clothing"],
    ["die#Bluse#blouse", "Clothing"],
    ["der#Gürtel#belt", "Clothing"],
    ["die#Hose#(a pair of) trousers", "Clothing"],
    ["der#Rock#skirt", "Clothing"],
    ["der#Anzug#suit", "Clothing"],
    ["die#Jacke#jacket", "Clothing"],
    ["der#Mantel#coat", "Clothing"],
    ["die#Strickjacke#cardigan", "Clothing"],
    ["der#Handschuh#glove", "Clothing"],
    ["die#Handschuhe#gloves", "Clothing"],
    ["die#Krawatte#tie", "Clothing"],
    ["der#Strumpf#stocking", "Clothing"],
    ["der#Schuh#shoe", "Clothing"],
    ["der#Stiefel#(high) boot", "Clothing"],

    // Family
    ["die#Familie#family", "Family"],
    ["das#Baby#baby", "Family"],
    ["der#Bruder#brother", "Family"],
    ["der#Cousin#cousin", "Family"],
    ["das#Kind#child", "Family"],
    ["die#Eltern#parents", "Family"],
    ["der#Erwachsener#adult", "Family"],
    ["der#Opa#grandpa/granddad", "Family"],
    ["der#Nachname#surname", "Family"],
    ["der#Freund#friend", "Family"],
    ["die#Freundschaft#friendship", "Family"],
    ["der#Gast#guest", "Family"],
    ["die#Gastfreundschaft#hospitality", "Family"],
    ["die#Geburt#birth", "Family"],
    ["der#Geburtstag#birthday", "Family"],
    ["der#Onkel#uncle", "Family"],
    ["die#Bruderschaft#brotherhood", "Family"],
    ["die#Schwester#sister", "Family"],
    ["die#Großeltern#grandparents", "Family"],
    ["die#Großmutter#grandmother", "Family"],
    ["der#Großvater#grandfather", "Family"],
    ["die#Hausnummer#house number", "Family"],
    ["der#Junge#boy", "Family"],
    ["das#Mädchen#girl", "Family"],
    ["der#Mann#man", "Family"],
    ["die#Mutter#mother", "Family"],
    ["die#Mutti#mum", "Family"],
    ["der#Name#name", "Family"],
    ["die#Oma#granny", "Family"],
    ["die#Tochter#daughter", "Family"],
    ["der#Schwager#brother-in-law", "Family"],
    ["die#Schwägerin#sister-in-law", "Family"],
    ["die#Schwiegermutter#mother-in-law", "Family"],
    ["der#Schwiegervater#father-in-law", "Family"],
    ["der#Sohn#son", "Family"],
    ["der#Stiefvater#stepfather", "Family"],
    ["die#Stiefmutter#stepmother", "Family"],
    ["die#Tante#aunt", "Family"],
    ["der#Wohnort#place of residence", "Family"],
    ["der#Vater#father", "Family"],
    ["der#Papa#dad", "Family"],
    ["der#Vati#dad", "Family"],
    ["der#Vorname#first name", "Family"],
    ["der#Zwilling#twin", "Family"],

    // Hobbies & Sports
    ["der#Federball#badminton", "Hobbies"],
    ["das#Badminton#badminton", "Hobbies"],
    ["der#Basketball#basketball", "Hobbies"],
    ["der#Besuch#visit", "Hobbies"],
    ["die#Briefmarke#stamp", "Hobbies"],
    ["das#Buch#book", "Hobbies"],
    ["der#CD-Spieler#CD player", "Hobbies"],
    ["der#Computer#computer", "Hobbies"],
    ["die#Disco#disco", "Hobbies"],
    ["das#Finale#final", "Hobbies"],
    ["der#Fan#fan", "Hobbies"],
    ["die#Fitness#fitness", "Hobbies"],
    ["das#Foto#photo", "Hobbies"],
    ["der#Fotoapparat#camera", "Hobbies"],
    ["die#Freundin#girlfriend", "Hobbies"],
    ["der#Fußball#football", "Hobbies"],
    ["die#Gruppe#group", "Hobbies"],
    ["die#Bewegung#movement", "Hobbies"],
    ["das#Hallenbad#indoor swimming pool", "Hobbies"],
    ["das#Hobby#hobby", "Hobbies"],
    ["das#Hockey#hockey", "Hobbies"],
    ["das#Instrument#instrument", "Hobbies"],
    ["das#Werkzeug#tool", "Hobbies"],
    ["der#Jugendklub#youth club", "Hobbies"],
    ["die#Karte#card", "Hobbies"],
    ["die#Kassette#cassette", "Hobbies"],
    ["das#Kino#cinema", "Hobbies"],
    ["das#Klavier#piano", "Hobbies"],
    ["die#Mannschaft#team", "Hobbies"],
    ["das#Mitglied#member", "Hobbies"],
    ["die#Musik#music", "Hobbies"],
    ["der#Park#park", "Hobbies"],
    ["der#Rollschuh#roller skate", "Hobbies"],
    ["das#Rugby#rugby", "Hobbies"],
    ["das#Schwimmbad#swimming pool", "Hobbies"],
    ["das#Spiel#game", "Hobbies"],
    ["der#Spielplatz#playground", "Hobbies"],
    ["der#Sport#sport", "Hobbies"],
    ["das#Stadion#stadium", "Hobbies"],
    ["die#Stadt#town", "Hobbies"],
    ["das#Tennis#tennis", "Hobbies"],
    ["das#Theater#theatre", "Hobbies"],
    ["das#Tischtennis#table tennis", "Hobbies"],
    ["der#Verein#club", "Hobbies"],
    ["das#Videospiel#video game", "Hobbies"],
    ["der#Wettbewerb#competition", "Hobbies"],
    ["das#Wochenende#weekend", "Hobbies"],
    ["die#Zeitschrift#magazine", "Hobbies"],

    // Entertainment
    ["das#Abenteuer#adventure", "Entertainment"],
    ["die#Anzeige#advertisement", "Entertainment"],
    ["der#Ausflug#trip", "Entertainment"],
    ["der#Ausweis#identity card", "Entertainment"],
    ["der#Dokumentarfilm#documentary", "Entertainment"],
    ["der#Eingang#entrance", "Entertainment"],
    ["der#Auftritt#entrance", "Entertainment"],
    ["das#Eintrittsgeld#entrance fee", "Entertainment"],
    ["der#Film#film", "Entertainment"],
    ["die#Freizeit#leisure", "Entertainment"],
    ["die#Vernunft#reason", "Entertainment"],
    ["der#Horrorfilm#horror movie", "Entertainment"],
    ["die#Auskunft#information desk", "Entertainment"],
    ["der#Informationsschalter#information desk", "Entertainment"],
    ["die#Komödie#comedy", "Entertainment"],
    ["das#Konzert#concert", "Entertainment"],
    ["der#Krimi#crime film", "Entertainment"],
    ["die#Liebesgeschichte#romance", "Entertainment"],
    ["das#Lied#song", "Entertainment"],
    ["die#Liste#list", "Entertainment"],
    ["die#Nachrichten#news", "Entertainment"],
    ["die#Nachricht#news", "Entertainment"],
    ["der#Pop#pop", "Entertainment"],

    // Countries & People
    ["der#Belgier#Belgian", "Countries"],
    ["der#Engländer#English man", "Countries"],
    ["die#Engländerin#English woman", "Countries"],
    ["der#Franzose#French man", "Countries"],
    ["die#Französin#French woman", "Countries"],
    ["der#Holländer#Dutch man", "Countries"],
    ["die#Holländerin#Dutch woman", "Countries"],
    ["der#Ire#Irish man", "Countries"],
    ["die#Irin#Irish woman", "Countries"],
    ["das#Belgien#Belgium", "Countries"],
    ["das#England#England", "Countries"],
    ["das#Frankreich#France", "Countries"],
    ["das#Griechenland#Greece", "Countries"],
    ["die#Niederlande#the Netherlands", "Countries"],
    ["das#Österreich#Austria", "Countries"],
    ["das#Portugal#Portugal", "Countries"],
    ["das#Schottland#Scotland", "Countries"],
    ["die#Schweiz#Switzerland", "Countries"],
    ["das#Spanien#Spain", "Countries"],
    ["die#Türkei#Turkey", "Countries"],
    ["der#Artikel#article", "Countries"],
];

/** Check whether a word follows a strong suffix/prefix gender rule */
export function hasRule(word: string, article: string): boolean {
    const lw = word.toLowerCase();

    const feminineSuffixes = ['ung', 'heit', 'keit', 'schaft', 'tion', 'tät', 'ik', 'ei', 'ie', 'ur', 'enz'];
    for (const s of feminineSuffixes) {
        if (lw.endsWith(s) && article === 'die') return true;
    }

    const neuterSuffixes = ['chen', 'lein', 'ment', 'um', 'ma'];
    for (const s of neuterSuffixes) {
        if (lw.endsWith(s) && article === 'das') return true;
    }

    const masculineSuffixes = ['ling', 'ismus', 'or', 'ig', 'ich', 'ant', 'ast', 'us'];
    for (const s of masculineSuffixes) {
        if (lw.endsWith(s) && article === 'der') return true;
    }

    if (lw.startsWith('ge') && article === 'das') return true;
    if (lw.endsWith('e') && article === 'die') return true;
    if (lw.endsWith('en') && article === 'der') return true;
    if (lw.endsWith('er') && article === 'der') return true;

    return false;
}

export function generateItems(): PracticeItem[] {
    return rawData.map(([itemStr, category], index) => {
        const [answer, word, hint] = itemStr.split('#').map(s => s.trim());
        return {
            id: String(index),
            word,
            answer,
            hint,
            options: ["der", "die", "das"],
            category,
        };
    });
}

/** Get all unique thematic categories */
export function getCategories(): string[] {
    const cats = new Set(rawData.map(([, cat]) => cat));
    return Array.from(cats);
}

export function shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
