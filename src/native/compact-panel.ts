import type {BlockResponse,FormField,ActionElement} from '@emdash-cms/blocks';
import type {EventualContext} from '../storage';
import {scheduleFields} from './schedule-panel';
import {recurrenceToFormValues,formatHumanRecurrence} from './event-commands';
import {inspectNativeOccurrences} from './occurrence-service';
import {normalizeNativeSchedule} from '../domain/native-validation';
import {addDays} from '../domain/recurrence';
import {WEEKDAYS} from '../domain/recurrence-rule';
import {referenceField,referenceId,eventSchema,referenceTarget} from '../domain/native-references';
import {listNative} from '../domain/native-source';
import {directoryChoices} from './directory';
import {portableTextToPlainText} from '../domain/portable-text';

const input=(id:string,label:string,value:unknown='',multiline=false):FormField=>({type:'text_input',action_id:id,label,initial_value:String(value ?? ''),multiline});
const select=(id:string,label:string,options:{value:string;label:string}[],value:unknown):FormField=>({type:'select',action_id:id,label,options,initial_value:String(value ?? '')});
const date=(id:string,label:string,value:unknown):FormField=>({type:'date_input',action_id:id,label,initial_value:String(value ?? '')});
const form=(id:string,label:string,fields:FormField[]):BlockResponse['blocks'][number]=>({type:'form',block_id:id,fields,submit:{action_id:id,label}});
const button=(action_id:string,label:string,value:unknown):ActionElement=>({type:'button',action_id,label,value});
const section=(label:string,blocks:BlockResponse['blocks'],open=false):BlockResponse['blocks'][number]=>({type:'accordion',label,blocks,default_open:open});
type State={selectedId:string;offset:number;windowStart?:string;locale:string;uiLocale:string;values?:Record<string,unknown>;error?:string;message?:string;action?:string};

/** The core editor owns the announcement; this panel contains domain controls only. */
export async function renderCompactSchedule(fields:Record<string,unknown>,ctx:EventualContext,state:State):Promise<BlockResponse> {
  const blocks:BlockResponse['blocks']=[];
  if(state.error) blocks.push({type:'banner',title:'Check these details',description:state.error,variant:'error'});
  blocks.push(section('When',[form('apply-schedule','Save dates to draft',scheduleFields(fields,'',state.values))],true));
  const rule=recurrenceToFormValues(fields.recurrence),defaults={...rule,...state.values};
  const frequency=rule.frequency==='monthly' ? rule.monthlyPatternType==='weekdayOfMonth'?'monthly-weekday':'monthly-day':rule.frequency;
  const weekdays=[...WEEKDAYS.slice(1),WEEKDAYS[0]!].map(value=>({value,label:value[0]!.toUpperCase()+value.slice(1)}));
  const repeat:FormField[]=[select('frequency','Repeat',[{value:'none',label:'Does not repeat'},{value:'daily',label:'Daily'},{value:'weekly',label:'Weekly'},{value:'monthly-day',label:'Monthly — day of month'},{value:'monthly-weekday',label:'Monthly — weekday position'}],defaults.frequency==='monthly'?frequency:defaults.frequency)];
  for(const [value,id,label] of [['daily','days','Every … days'],['weekly','weeks','Every … weeks'],['monthly-day','months','Every … months'],['monthly-weekday','months_weekday','Every … months']])
    repeat.push({type:'number_input',action_id:'interval_'+id,label,initial_value:Number(defaults['interval_'+id as keyof typeof defaults] ?? defaults.interval ?? 1),min:1,max:52,condition:{field:'frequency',eq:value}});
  repeat.push({...date('until','Last repeat date',defaults.until),condition:{field:'frequency',neq:'none'}},
    {type:'checkbox',action_id:'weekdays',label:'Days of the week',options:weekdays,initial_value:Array.isArray(defaults.weekdays)?defaults.weekdays:[],condition:{field:'frequency',eq:'weekly'}},
    {type:'number_input',action_id:'dayOfMonth',label:'Day of month',initial_value:Number(defaults.dayOfMonth ?? (String(fields.start_date ?? fields.start ?? '').slice(8,10) || 1)),min:1,max:31,condition:{field:'frequency',eq:'monthly-day'}},
    {...select('missingDayBehavior','When this day does not exist',[{value:'skip',label:'Skip that month'},{value:'lastDay',label:'Use the month’s last day'}],defaults.missingDayBehavior ?? 'skip'),condition:{field:'frequency',eq:'monthly-day'}},
    {...select('weekday','Weekday',weekdays,defaults.weekday ?? 'monday'),condition:{field:'frequency',eq:'monthly-weekday'}},
    {...select('position','Weekday position',[1,2,3,4,5,'last'].map((value,index)=>({value:String(value),label:['First','Second','Third','Fourth','Fifth','Last'][index]!})),defaults.position ?? 1),condition:{field:'frequency',eq:'monthly-weekday'}});
  blocks.push(section('Repeat',[{type:'context',text:formatHumanRecurrence(fields.recurrence)},form('apply-recurrence','Save repeat settings',repeat)],state.action==='apply-recurrence'));
  const schema=await eventSchema(ctx);
  const directory:FormField[]=[];
  for(const [field,label] of [['venue','Saved venue'],['organizer_ref','Saved organizer']] as const) {
    const column=referenceField(schema,field);
    if(!schema?.fields.some(item=>item.slug===column)) continue;
    const target=referenceTarget(schema,field),id=referenceId(fields[column]);
    const schemas=await ctx.schema?.listCollections() ?? [];
    const rows=schemas.some(item=>item.slug===target)?await listNative(ctx,target):[];
    const choices=directoryChoices(rows,state.locale,id,undefined,field==='venue',998).choices;
    directory.push({type:'combobox',action_id:field,label,options:[{value:'',label:field==='venue'?'No saved venue':'No saved organizer'},...choices],initial_value:id ?? ''});
  }
  // apply-details preserves references whose controls aren't present.
  blocks.push(section('Where',[form('apply-details','Save venue and organizer',directory)],state.action==='apply-details'));
  try {
    normalizeNativeSchedule(fields,{allowStaleOccurrenceCopy:true});
    const today=new Date().toISOString().slice(0,10),first=String(fields.start_date ?? fields.start ?? '').slice(0,10);
    const from=state.windowStart ?? (first>today?first:today),through=addDays(from,89);
    const inspected=inspectNativeOccurrences(fields,from,through,20,state.offset);
    const dates:BlockResponse['blocks']=[form('inspect-window','Show dates',[date('from','Show dates from',from)]),{type:'context',text:from+' — '+through}];
    for(const occurrence of inspected.occurrences) {
      dates.push({type:'section',block_id:'eventual-verbatim:'+occurrence.recurrenceId,text:occurrence.scheduledLocalStart+' → '+occurrence.scheduledLocalEnd+' · '+occurrence.status},
        {type:'actions',elements:[button('edit-occurrence','Change date',occurrence.recurrenceId),...(occurrence.status==='cancelled'?[button('restore-occurrence','Restore date',occurrence.recurrenceId)]:[button('cancel-occurrence','Cancel date',occurrence.recurrenceId)]),...(occurrence.status==='modified'?[button('restore-occurrence','Restore date',occurrence.recurrenceId)]:[])]});
    }
    const pages:ActionElement[]=[];
    if(state.offset) pages.push(button('page-occurrences-prev','Previous dates',JSON.stringify({from,offset:Math.max(0,state.offset-20)})));
    if(inspected.hasMore) pages.push(button('page-occurrences-next','Next dates',JSON.stringify({from,offset:state.offset+20})));
    if(pages.length) dates.push({type:'actions',elements:pages});
    dates.push({type:'actions',elements:[button('window-prev','Previous 90 days',addDays(from,-90)),button('window-next','Next 90 days',addDays(from,90))]});
    const selected=inspected.occurrences.find(row=>row.recurrenceId===state.selectedId);
    if(selected) {
      const recurrence=select('recurrence_id','Occurrence',[{value:selected.recurrenceId,label:selected.scheduledLocalStart}],selected.recurrenceId);
      const effective={...fields,all_day:selected.allDay,timezone:selected.timezone,...(selected.allDay?{start_date:selected.effectiveStart,end_date:selected.effectiveEnd}:{start:selected.effectiveStart,end:selected.effectiveEnd})};
      dates.push(form('reschedule-occurrence','Save changed date',[recurrence,...scheduleFields(effective,'override_',state.values)]));
      const editorial=selected.localizedCopy ?? {};
      dates.push(form('set-occurrence-copy','Save announcement for this date',[recurrence,...(['title','description','location','organizer'] as const).flatMap((key):FormField[]=>[
        {type:'toggle',action_id:'use_'+key,label:'Use a different '+key,initial_value:editorial[key]!==undefined},
        {...input('copy_'+key,key[0]!.toUpperCase()+key.slice(1),key==='description'?portableTextToPlainText(editorial[key]):editorial[key],key==='description'),condition:{field:'use_'+key,eq:true}}])]),
        {type:'actions',elements:[button('clear-occurrence-copy','Use the series announcement',selected.recurrenceId)]});
    }
    blocks.push(section('Individual dates',dates,!!state.selectedId));
  } catch(error) {blocks.push(section('Individual dates',[{type:'context',text:error instanceof Error?error.message:'Check the event schedule.'}]));}
  return {blocks};
}
