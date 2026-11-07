// Compact BPE-compressed unified translation dictionary (fr=0, de=1, nl=2, es=3)
export type MessageDictionary = Record<string, string>;

export function resolveLanguage(locale = 'en'): string {
  if (!locale) return 'en';
  return locale.toLowerCase().split(/[-_]/)[0];
}

const langIndices: Record<string, number> = { fr: 0, de: 1, nl: 2, es: 3 };

export const dictionaries: Record<string, MessageDictionary> = new Proxy({} as any, {
  get: (_, lang: string) => lang in langIndices ? new Proxy({} as any, {
    get: (_, key: string) => nativeEditorText(key, lang)
  }) : undefined
});

export const french = dictionaries.fr;
export const german = dictionaries.de;
export const dutch = dictionaries.nl;
export const spanish = dictionaries.es;

const BPE_TOKENS = "!#$%&'*+/12345678:;<=>?@XY[]^_{|}~ĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌō";
const BPE_DICT: string[] = [" de","rgani"," da","ent","tion","nregistr","speicher","Veranstalter","en\t","er ","en ","es\n"," … ","opslaan\tGuardar ","ollec","$te","! la sema","atum","echa","ste","c6tie\tColección! ","Ev%"," día","ag\t","Termin","r guardado\n","der","es ","jour","nem%","ont","#sator","ing","zon","useau horaire","ndividu","Tag!s Monats","g van! maand"," mois","épéti&","pgeslag2","repetición","e$tums\tF;s ","aramètres\tEin<llung","ocatie","Wie[holung","c6&\tC6&!s "," e'é","#zado","Start","\tChaque","day\t","a horaria","\tMaandelijks —","\tMonatlich — ","Save","ual ","ième\t"," venue"," o#zer","\tAn[e "," saved"," 90$ys\t90 ^s ","anterior3Next"," time\tHeure! ","Woch%agsposi&","beher/Ges&ar ","#sa&","\tDat"," repeat","s\tAlle4"," sett}s\tE'1l","s\tVorherige ","e 90$g/90?s ","van e2hele$g","eekday posi&","ar f;","\tEve_","\tVérifiez ","tijd\tHora! ","s\tTous les4","\tKein ge*t1","\tCompruebe ","ver","l m3"," ev%","IANA","ter\t","\tHerha","ime ~e","Zeit~e","/Cada4","\nM{hly —","\tAutre fĀ","1les7s\tXe ","8ine\tWoch%","90 Tage\tVo","! todo el?","lieux\tOrte","\nCheck the","MensĖ—","précéd%","début\tď","s\tNäch< ","anztägig","\tOtra ~Ē","$ns leĄ\t","s\tGér1l]","van! week","\nPrevious","\tAf~[lijk","types\tCon"];
const BPE_DATA = "ĕ7s to draft\tE'ļim Entwurf *n\tD:s opslaan als concept\tGuardĪs 2borrador\nĕģĥa rą\tċsein<llung2*nĶl}sin<ll}25ć\nĕĘ andę\tE'1le lieu et l’oġ\tOrt und + *n\tLĊ 2o| 5lugar y oĎr\nĕ changed7\tE'1cette7\tGeän[t]D: *n\tGewijzigde$tum 5f; modificada\nDays of the week\tJoursĽage\tDag2Ŋ\tDías8na\nMonđLundi\tM{@Maand@Lun3TuesđMardi\tDienst@Dinsd@Mart3WednesđMercredi\tMittwoch\tWoensd@Miércol3ThursđJeudi\tDonnerst@Don[d@Juev3FriđVendredi\tFreit@Vrijd@Viern3SaturđSamedi\tSamst@Zaterd@Sábado\nSunđDimanche\tSonnt@Zond@Dom}oĺ$y of m{hĐĄ, même7ĔĂē$ă\tł?!ĲChange7\tModifi1la7\tD: än[n\tD: wijzig/ModificĪ\nRestore7\tRétablir la7\tD: wie[her<ll/D: her<ll/Restablec1f;ŋĜŃĦľrigħĝĜsuivantŅľlgendħsigui%3OccurrenceĢe iāelle\tEinzelterminŌe$tum\tF; iāal\nWh/Quand\tWann\tWanneer\tCuándo\nWhere\tOù\tWo\tWaar\tDónde\nRepeat\tRą\tċĶl/Repetir\nIāal7sĢ]iāelles\tEinzelne XeŌĈiāal3All-dayĳ\tToute la ^née\tGņ]>ī Ĩ\t>oĿ\nď7Ģe! ńd:\tďd:\tF;! inicio\nďĞńzeit\tďĭinicio\nEnd7 (last$y for all-dayĳs)Ģe! fin ([ni1^ inclus si ^née %ière)\tEndd: (letzt1Tag für gņe >s)\tEindd: (laat<$g voor eve_2Ĩ)\tF;! fin (último? paraĳosĿ)\nEndĞfin\tEndzeit\tEindĭfin\nTķ\tFĀ\tĸ\tTijd~e\tZonĒ\nOth1tķ…Ļ…Ěĸ…Ětijd~e…Ň…\nOth1Ĵ tķĻ (nom Ĵ)Ěĸ (Ĵ-Name)Ětijd~e (Ĵ-naam)Ň (nombre Ĵ)\nDo]notģ\tNe se répète pas\tWie[holt sich nichtĶalt niet\tNo se repite\nDailyĐ ^\tTäglich\tDagelijks\tDiario\nWeeklyĐ semaine\tWöch%lich\tWekelijks\tSemanalĺ wĩĐĄ, un ^ précis8ineĔğē positie Ŋd@ł posición!l?8na\nEıy …$yĮ^ĤTage\tElke …$gĹdías\nEıy4weeks\tTout]les4semaineĤWoch/Elke4wekĹsemanas\nEıy4m{hĮmoiĤMonate\tElke4maandĹmes3Lastģ7\tDernière7! rą\tLetzt]ċsd:\tLaat< herhal}sd:\tÚltima f;! ć\nDay of m{h\tJour duĄ\tĂ\tDaă\tDía!ĲWh2this$y do]not exist\tSi ce ^ n’exi< pasňWenn dies1Tag nicht existiert\tWanneer!ze$g niet bestaat\tSi e<? no exi< 2eĲSkip that m{h\tPass1ceĄ\tDies2Monat überspr}/Die maand oıslaan\tOmitir ese m3Use the m{h’s last$y\tUtilis1le!rni1^ duĄ\tLetzt2Ă ıwend/Laat<$ă gebruik/Usar el último?!ĲWĩ\tPosi&ňğ\tPositie in! maand\tPosición 2eĲWeekđJourĽ@Weekd@Día8na\nFirst\tPremier\tEr<r\tEer<\tPrimero\nSecond\tDeuxėZweiĵTweede\tSegundo\nThird\tTroisėDritĵDerde\tTercero\nFourth\tQuatrėVierĵVierde\tCuarto\nFifth\tCinquėFünfĵVijfde\tQuinto\nLast\tDernier\tLetzĵLaat<\tÚltimo\nĕdĘ\tLieuč\tGe*t1Ort\tOĆlĊ\tLugaYĕdę\tOġče\tGe*t1+\tOĆo|\tOĎYNoěĘ\tAucun lieučįOrt\tGe2oĆlĊ\tN}ún lugaYNoěę\tAucune oġčeį+\tGe2oĆo|\tN}ún oĎYManageĘŉŀ ıwalt/Locati]Ġlugar3Manageęŉoġs\t+ ıwalt/O|2ĠoĎr3Show7s\tAffichļanzeig/D:s weergev/MostrĪsŋ7sĢ]ŃeĦXe\tVorigĈĝ7sĢ]suivanteŅXe\tVolgendĈsigui%3Cancel7\tAnnul1la7\tX absag/D: annuler/CancelĪŁse!tailsĬc]informa&s\tDetails überprüf/C{roleer!ze gegevensİestos$tosŁĳ schedule.Ĭles7s et la rą! l’évé_.\tÜberprüf2Sie!n Xplan!s >s.\tC{role1het eve_enschema.İlas f;s y la ć!lĳo.\n>s\tÉvé_s\t>sī/>os\n>\tÉvé_\t>ī\t>o\nVenues\tLieux\tVeranstaltungsorte\tLĊs\tLugar3O#zers\tOġs\t+\tO|/OĎr3Sett}s\tPĉ/In<ll}/Ajust3> Čévé_s\t>-C6&īen=ev%os\nVenue Čŀ-C6&\tLĊ=lugar3O#z1Čoġs\t+-C6&\tO|en=oĎr3ĕĥ]pĉ2*n\tIn<ll}25ajust3Sett}s notě\tParamètr]nončs\t\t\t\nConnect >Ėto c{% ōnect1>Ėaux types! c{enu\t>Ėmit Inhaltstyp2ıknüpf/>Ėıbind2met c{%ōectar >Ėcon los tipos! c{enido\nSchedule draftě.\tBrouillon!s7sč.\t\t\t";

function unpack(): Record<string, string[]> {
  let s = BPE_DATA;
  for (let i = BPE_DICT.length - 1; i >= 0; i--) {
    s = s.replaceAll(BPE_TOKENS[i], BPE_DICT[i]);
  }
  const table: Record<string, string[]> = {};
  for (const line of s.split('\n')) {
    const parts = line.split('\t');
    table[parts[0]] = parts.slice(1);
  }
  return table;
}

const T = unpack();

export function nativeEditorText(value: string, locale = 'en'): string {
  const lang = resolveLanguage(locale);
  if (lang === 'en') return value;
  const idx = langIndices[lang];
  if (idx === undefined) return value;
  const row = T[value];
  return (row && row[idx]) ? row[idx] : value;
}
