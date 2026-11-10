export type YamlValue = string | number | boolean | null | YamlValue[] | {
    [key: string]: YamlValue;
};
export type YamlMap = {
    [key: string]: YamlValue;
};
export declare function parseYaml(source: string, name?: string): YamlValue;
