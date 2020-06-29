const crypto = require('crypto')   
const {objectSce,stringSce,arraySce} = require("@nxn/ext");
// const querystring = require("querystring");
// const configSce = require('./config.service');
const { parse, eval } = require('expression-eval');

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

    evalExpression(expr,obj) {
        const ast = parse(expr); 
        const value = eval(ast, obj); 
        return value;
    }

    mapFieldMacros(fname,obj,map,regVar,regExpr) {
        let pattern = map[fname];

        if(!pattern)
            return obj[fname]||null;

        pattern = pattern.trim();

        if(pattern.startsWith)
        {
            let isString = false;
            if(pattern.startsWith('${{') && pattern.endsWith('}}'))
            {
                let pattern2 = pattern.trim().slice(3).slice(0,-2);
                if(pattern2.indexOf('${')==-1)
                {
                    return this.evalExpression(pattern2,obj);
                }
                else
                    // expression and other stuff like viariables
                    isString = true;
            }       
    
            // ${VAR} => copy value as is (with same type etc.)
            if(!isString && pattern.startsWith('${') && pattern.endsWith('}'))
            {
                let pattern2 = pattern.trim().slice(2).slice(0,-1);
                // check if no other ${VAR2} in the pattern
                if(pattern2.indexOf('${')==-1)
                {
                    pattern2 = pattern2 || fname; // supports = or =name
                    return this.mapPattern(pattern2,obj);
                }
                else
                    // includes other variables, so must be a string...
                    isString = true;
            }       
    
            if(pattern.startsWith('$ref(') && pattern.endsWith(')'))
            {
                let inc = pattern.trim().slice(5).slice(0,-1);
                return this.configSce.loadConfig(inc,null,obj);
            }
        }

        // process ${{ expression }}
        regExpr = regExpr || /\$\{\{([^\}]+)\}\}/gi;
        let rep =pattern.replace(regExpr,
            (match,p1) => { 
                return this.evalExpression(p1,obj);
            });

        // process ${VARIABLES}
        regVar = regVar || /\$\{([a-z 0-9_|]+)\}/gi;
        rep =rep.replace(regVar,
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
            else if(v instanceof Array)
                to[k] = this.mapArray(v,from);
            else  if(typeof v =="object")
                to[k] = this.mapObj(v,from);
            else
                // boolean
                to[k] = v;
        });

        return to;
    }

    mapArray(map,from,reg)
    {
        let to = [];

        arraySce.forEachSync(map,(v,k) => {
            if(typeof v =="string")
                to[k] = this.mapFieldMacros(k,from,map,reg)
            else if(v instanceof Array)
                to[k] = this.mapArray(v,from);
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
