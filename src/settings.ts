
export interface MySettings {
    convertDailyNoteTitles: boolean;
    dateDisplayFormat: string;
}
  
export const DEFAULT_SETTINGS: MySettings = {
    convertDailyNoteTitles: true,
    dateDisplayFormat: 'ddd, Do MMMM YYYY'
}

export function getDailyNoteFormat(): string {
    let formatString : string = null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { internalPlugins, plugins } = <any>window.app;
        const { format } =
        internalPlugins.getPluginById("daily-notes")?.instance?.options || {};
        formatString = format;
    } catch (err){
        console.log("Couldn't find daily notes settings")
    }
    
    return formatString || "YYYY-MM-DD";
}