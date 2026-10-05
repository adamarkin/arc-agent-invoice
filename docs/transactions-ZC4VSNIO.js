import"./chunk-3YPSL3T5.js";import"./chunk-HVPJE6AV.js";import"./chunk-W3F2UAA5.js";import"./chunk-CBTBSRBY.js";import"./chunk-RI24VZ65.js";import"./chunk-74AYJJ5L.js";import"./chunk-U4XVTSXE.js";import{C as a,M as p,t as c,w as m}from"./chunk-46I7KND6.js";import"./chunk-IV5FR2YO.js";import"./chunk-2QY6DLYH.js";import"./chunk-HVXHO4O5.js";import"./chunk-CM4FP3X2.js";import"./chunk-S5WMOIP3.js";import"./chunk-A6P52Y7V.js";import"./chunk-KL2DZ7E2.js";var w=c`
  :host > wui-flex:first-child {
    height: 500px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }

  :host > wui-flex:first-child::-webkit-scrollbar {
    display: none;
  }
`;var u=function(o,e,i,r){var l=arguments.length,t=l<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")t=Reflect.decorate(o,e,i,r);else for(var f=o.length-1;f>=0;f--)(n=o[f])&&(t=(l<3?n(t):l>3?n(e,i,t):n(e,i))||t);return l>3&&t&&Object.defineProperty(e,i,t),t},s=class extends a{render(){return m`
      <wui-flex flexDirection="column" .padding=${["0","3","3","3"]} gap="3">
        <w3m-activity-list page="activity"></w3m-activity-list>
      </wui-flex>
    `}};s.styles=w;s=u([p("w3m-transactions-view")],s);export{s as W3mTransactionsView};
