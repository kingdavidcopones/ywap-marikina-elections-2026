export function MeshGradient() {
  return (
    <>
      <svg className="mesh-gradient" aria-hidden="true" focusable="false" viewBox="0 0 1000 800" preserveAspectRatio="none">
        <g className="mesh-blob mesh-blob-one">
          <g className="mesh-pulse mesh-pulse-one">
            <path d="M-124 108C-36 -62 252 -84 366 84C452 212 372 398 194 428C34 456 -120 352 -160 216C-170 182 -158 144 -124 108Z" />
          </g>
        </g>
        <g className="mesh-blob mesh-blob-two">
          <g className="mesh-pulse mesh-pulse-two">
            <path d="M658 -118C818 -210 1026 -94 1082 82C1138 256 1020 412 846 390C662 366 560 210 592 72C604 20 622 -94 658 -118Z" />
          </g>
        </g>
        <g className="mesh-blob mesh-blob-three">
          <g className="mesh-pulse mesh-pulse-three">
            <path d="M-94 510C22 404 238 436 308 568C382 708 266 864 86 874C-92 884 -202 746 -154 612C-142 576 -120 536 -94 510Z" />
          </g>
        </g>
        <g className="mesh-blob mesh-blob-four">
          <g className="mesh-pulse mesh-pulse-four">
            <path d="M670 474C820 388 1034 478 1098 620C1156 746 1084 890 918 918C750 946 602 836 590 688C580 600 622 502 670 474Z" />
          </g>
        </g>
        <g className="mesh-blob mesh-blob-five">
          <g className="mesh-pulse mesh-pulse-five">
            <path d="M248 154C382 74 576 136 616 272C660 422 526 540 370 494C224 450 148 332 190 228C202 198 224 170 248 154Z" />
          </g>
        </g>
        <g className="mesh-blob mesh-blob-six">
          <g className="mesh-pulse mesh-pulse-six">
            <path d="M378 570C520 456 744 492 798 646C846 786 690 908 522 858C372 814 274 698 316 616C330 592 352 586 378 570Z" />
          </g>
        </g>
        <g className="mesh-blob mesh-blob-seven">
          <g className="mesh-pulse mesh-pulse-seven">
            <path d="M-82 286C36 196 188 248 232 370C276 496 186 608 44 592C-90 576 -172 458 -134 350C-124 324 -104 302 -82 286Z" />
          </g>
        </g>
      </svg>
      <svg className="mesh-grain" aria-hidden="true" focusable="false" viewBox="0 0 1000 800" preserveAspectRatio="none">
        <filter id="ywap-mesh-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1000" height="800" filter="url(#ywap-mesh-grain)" />
      </svg>
    </>
  );
}
