import { Group, Vector3 } from 'three';

import { TextEntity } from './src/entities/textEntity.js';
import { DimensionEntity } from './src/entities/dimensionEntity.js';
import { LineEntity } from './src/entities/lineEntity.js';
import { InsertEntity } from './src/entities/insertEntity.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { CircleEntity } from './src/entities/circleEntity';
import { SplineEntity } from './src/entities/splineEntity';
import { SolidEntity } from './src/entities/solidEntity';
import { HatchEntity } from './src/entities/hatchEntity';

import * as Helper from 'dxf/src/Helper';
import { Properties } from './src/entities/baseEntity/properties';

// DXF FORMAT DOCUMENTATION
// 

/**
 * @class DXFViewer
 * @classdesc Main class to create the dxf viewer object. 
 * This object will parse the dxf using skymakerolof's [dxf library](https://github.com/skymakerolof/dxf) and create a three.js object. 
 * [DXF FORMAT DOCUMENTATION](https://documentation.help/AutoCAD-DXF/WS1a9193826455f5ff18cb41610ec0a2e719-79f8.htm)
 */
export class DXFViewer {
    
    constructor() {
        this._cache = {};
        this.useCache = true;

        this.onBeforeTextChanged = null;
    }    

    /**
	 * Returns a Three.js object with the dxf data. Calls to getFromPath method internally
	 * @param file {File} dxf file to load.
	 * @param fontPath {string} path to the font file.
     * @return {THREE.Group} object with the dxf data
	*/
    async getFromFile( file, fontPath ) {
        let path = URL.createObjectURL( file );

        return await this.getFromPath( path, fontPath );
    }

    /**
	 * Returns a Three.js object with the dxf data.
	 * @param path path to a dxf file to load. Type: String
	 * @param fontPath path to the font file. Type: string	 
     * @return THREE.Group object with the dxf data
	*/
    async getFromPath( path, fontPath ) {

        await this._loadFont( fontPath );

        if( !this._font ) return null;

        return new Promise( async (resolve, reject) => {
            let cached = this._fromCache( path );
            
            //from cache
            if( cached ) {
                resolve( this._drawDXF( cached.data ? cached.data : cached ) );
                return;
            }
            
            //load file
            let rawdata = await fetch( path );
            if( rawdata.status !== 200 ) return null;            
            let file = await rawdata.text();

            //parse data
            let data = new Helper.default( file ).parse();

            //cache
            this._toCache( path, data );

            //return draw
            resolve( await this._drawDXF( data ) );
        } );
    }

    async _drawDXF( data ) {
        let group = new Group();

        //Change to false if we intent to modify the geometries. Otherwise the cached geometry will be modified too.
        if( !this.useCache ) Properties.cache = false;

        //initialize
        let lines = new LineEntity( data );
        let circles = new CircleEntity( data );
        let splines = new SplineEntity( data );
        let solids = new SolidEntity( data );
        let dimensions = new DimensionEntity( data, this._font );
        let texts = new TextEntity( data, this._font );
        let inserts = new InsertEntity( data, this._font );
        let hatchs = new HatchEntity( data, this._font );

        //add callbacks
        Properties.onBeforeTextDraw = this.onBeforeTextDraw;

        //draw
        lines = lines.draw( data );
        circles = circles.draw( data );
        splines = splines.draw( data );
        solids = solids.draw( data );
        dimensions = dimensions.draw( data );
        texts = texts.draw( data );
        inserts = inserts.draw( data, data );
        hatchs = hatchs.draw( data );

        //add to group
        if( lines ) group.add( lines );
        if( circles ) group.add( circles );
        if( splines ) group.add( splines );
        if( solids ) group.add( solids );
        if( dimensions ) group.add( dimensions );
        if( texts ) group.add( texts );
        if( inserts ) group.add( inserts );
        if( hatchs ) group.add( hatchs );

        //this._writeCount( lines, circles, splines, solids, dimensions, texts, inserts );

        this._rotateByView( group, data );

        return group;
    }
    
    _toCache( path, data ) {
        this._cache[this._replaceEspecialChars( path )] = data;
    }
    _fromCache( path ) {
        let cached = this._cache[this._replaceEspecialChars( path )];
        return cached ? cached : null;
    }

    _replaceEspecialChars( str ) {
        return str.replaceAll('/','').
                   replaceAll('.','').
                   replaceAll('_','').
                   replaceAll('-','');
    }

    async _loadFont( fontPath ) {
        if( this._font ) return;
        try{
            this._font = await new Promise( (resolve, reject) => {
                const loader = new FontLoader();
                loader.load( fontPath, resolve, null, reject );
            });
        }
        catch( e ) {
            console.log( e );
            this._font = null;
        }
    }

    _writeCount( lines, circles, splines, solids, dimensions, texts, inserts ) {
        if( lines ) console.log( 'lines ', lines.children.length );
        if( circles ) console.log( 'circles ', circles.children.length );
        if( splines ) console.log( 'splines ', splines.children.length );
        if( solids ) console.log( 'solids ', solids.children.length );
        if( dimensions ) console.log( 'dimensions ', dimensions.children.length );
        if( texts ) console.log( 'texts ', texts.children.length );
        if( inserts ) console.log( 'inserts ', inserts.children.length );
    }

    _rotateByView( group, data ) {
        let model = data.objects && data.objects.layouts ? data.objects.layouts.find( o => o.name.toLowerCase() === 'model' ) : null;
        if( !model ) return;
        let keys = Object.keys( data.tables.vports );
        for (let i = 0; i < keys.length; i++) {
            let vport = data.tables.vports[ keys[i] ];
            if( vport.handle === model.lastActiveViewport && vport.angle !== 0 ) {
		        group.rotateOnAxis( new Vector3( 0, 0, 1 ), vport.angle * Math.PI / 180 );
                return;
            }
        }
    }
}