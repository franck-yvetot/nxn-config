const crypto = require('crypto')   
const {objectSce,stringSce} = require("@nxn/ext");
// const querystring = require("querystring");
// const configSce = require('./config.service');

const pipes = {
    id : formatId,
    base64 : b64,
    decode64 : decodeB64,
    md5:md5,

    dateString:dateString,
    timestamp:timestamp,
    date: d => new Date(d),
    now: d => new Date(),

    url_encode:encodeURIComponent,

    trim: v => v.trim(),
    lower: v => v.lower(),
    upper: v => v.upper(),
    no_accents : stringSce.removeAccents,

    env:env,
    argv: i => argv(i)
};

class MapSce
{
    constructor() {
        this.init();
    }

    init() {
        // set pipe functions
        this.pipes = pipes;
    }

    // add a custom pipe filter
    addFilter(k,f) {
        this.pipes[k] = f;
    }

    not_found(pattern,path) {
        throw new Error("Variable not found : "+pattern+' at '+path);
    }

    mapPattern(pattern,obj)
    {
        let aPipes = pattern.split('|'); // supports yyy.xxx|id|lower|base64
        let patt = aPipes.shift(); 
        let attribs = patt.split('.'); // supports yyy.xxx
        
        // walk the object tree
        let obj2 = obj;
        attribs.forEach(k=> 
            obj2 && 
                (obj2=obj2[k])
                    || not_found(patt,k)
        );

        // now pipe the value to filters
        aPipes.forEach(pipe => {
            if(this.pipes[pipe])
                obj2 = this.pipes[pipe](obj2);
            else
                throw new Error("invalid ammping pattern, unknown pipe "+pipe);
        });
        
        return obj2;
    }

    mapFieldMacros(fname,obj,map,reg) {
        let pattern = map[fname];

        if(!pattern)
            return obj[fname]||null;

        pattern = pattern.trim();

        if(pattern.startsWith && pattern.startsWith('${') && pattern.endsWith('}'))
        {
            pattern = pattern.trim().slice(2).slice(0,-1);
            pattern = pattern || fname; // supports = or =name

            return this.mapPattern(pattern,obj);
        }       

        if(pattern.startsWith && pattern.startsWith('$ref(') && pattern.endsWith(')'))
        {
            let inc = pattern.trim().slice(5).slice(0,-1);
            return this.configSce.loadConfig(inc,null,obj);
        }       

        reg = reg || /\$\{([a-z 0-9_|]+)\}/gi;
        const rep =pattern.replace(reg,
            (match,p1) => { 
                return this.mapPattern(p1,obj);
            });

        return rep;    
    }

    mapObj(map,from,reg)
    {
        let to = {};

        objectSce.forEachSync(map,(v,k) => {
            if(typeof v =="string")
                to[k] = this.mapFieldMacros(k,from,map,reg)
            else  if(typeof v =="object")
                to[k] = this.mapObj(v,from);
            else
                // boolean
                to[k] = v;
        });

        return to;
    }

    mapConfig(config,variables,configSce)
    {
        this.configSce = configSce;
        
        return this.mapObj(config,variables);
    }
}

// private functions
function formatId(itemId) {
    itemId = itemId.replace(/[_\-.\s]/g,"-");
    itemId = stringSce.removeAccents(itemId);
  
    return itemId;
  }

  
function md5(s)
{
    return crypto.createHash('md5').update(s).digest("hex");
}

function b64(s) {
    return Buffer.from(s).toString('base64'); 
}
  
function decodeB64(s) {
// return Buffer.from(s).toString('ascii'); 
return Buffer.from(s, 'base64').toString('ascii');
}
  
function timestamp(date) {
    const d = date || new Date();
    return d.getTime();
}
  
function not_found(pattern,path) {
    throw new Error("Variable not found : "+pattern+' at '+path);
}

  function dateString(date,withSec) {
    const d = date || new Date();
  
    return d.getUTCFullYear() + 
        ("0" + (d.getUTCMonth()+1)).slice(-2) + 
        ("0" + d.getUTCDate()).slice(-2) +
        ("0" + d.getUTCHours()).slice(-2) +
        ("0" + d.getUTCMinutes()).slice(-2) +
        ("0" + d.getUTCSeconds()).slice(-2);     
  }

function urlEncode(s) {
    return 
}  

function env(v) {
    return process.env[v];
}

function argv(v) {
    const i = parseInt(v);
    return process.argv[v];
}

module.exports = new MapSce();
