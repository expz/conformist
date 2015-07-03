/*! 
 * Conformist.js 0.9
 * 
 * Copyright 2015 Jonathan Skowera
 * Released under the MIT License
 * https://github.com/expz/conformist.git
 *
 * Based loosely on BigText by Zach Leatherman
 * Requires jQuery v1
 */

(function( window, $ ) {
  "use strict";

  var oldConformist = window.Conformist;
  var oldjQueryMethod = $.fn.conform;
  window.Conformist = {
    minFontSizePx: 10,
    maxFontSizePx: 528,
    childSelector: ':not(br,script,canvas,del,embed,figure,hr,img,object)',
    exemptClass: 'nonconformist',
    styleIdPrefix: 'conformist-style',
    conformistIdPrefix: 'conformist-box',
    lineClassPrefix: 'conformist-line',
    noConflict: function(restore) {
      if(restore) {
        $.fn.conform = oldjQueryMethod;
        window.Conformist = oldConformist;
      }
      return Conformist;
    },
    getStyleId: function(id) { return Conformist.styleIdPrefix + '-' + id; },
    generateStyleTag: function(id, css) {
      return $('<style id="' + Conformist.getStyleId(id) + '">' 
               + css.join('\n') + '</style>');
    },
    clearCss: function(id) { $('#' + Conformist.getStyleId(id)).remove(); },
    generateCss: function(id, sizes) {
      var css = [];

      Conformist.clearCss(id);

      for(var j=0; j<sizes.fontSizes.length; j++) {
        css.push('#' + id + ' .' + Conformist.lineClassPrefix + j + ' {' +
          (sizes.minFontSizes[j] ? ' white-space: normal;' : '') +
          (sizes.fontSizes[j] ? 
            ' font-size: ' + sizes.fontSizes[j] + 'em;' :
            '') +
          (sizes.wordSpacings[j] ?
            ' word-spacing: ' + sizes.wordSpacings[j] + 'px;' : 
            '') +
        '}');
      }

      return Conformist.generateStyleTag(id, css);
    },
    init: function() {
      if(!$('#' + Conformist.getStyleId('global')).length) {
        $('head').append(Conformist.generateStyleTag(
          'global', 
          ['.conform * { white-space: nowrap; };',
            '.conform > * { display: block; };',
            '.conform .' + Conformist.exemptClass + ' { white-space: normal; }'
          ]));
      }
    },
    calculateFontSize: function($line, maxLineWidth) {
      /* 
       * Choose the greatest font-size which does not overflow the max width.
       *
       * Sometimes this will result in a width which is significantly less
       * than the max width:
       *   for monospace fonts (they resize in jumps)
       *   for browsers not supporting the necessary font resolution
       * So we set word-spacing to push the line out to full width.
       */ 
      var fontSize, wordSpacing, minFontSize;

      if($line.hasClass(Conformist.exemptClass)) {
        fontSize = null;
        minFontSize = false;
        wordSpacing = null;
      } else {
        var $container = $line.parent();

        var emsize = parseFloat($container.css('font-size'));
        var currentFontSize, fontToWidthRatio, newFontSize, 
            currentWordSpacing, wordSpacingDelta, oldWordSpacing;

        /* Font Size */

        // Use em instead of px otherwise IE won't allow resetting it

        // Iterate to choose a font width
        for (var k=1; k<=3; k++) {
          currentFontSize = parseFloat($line.css('font-size')) / emsize;
          fontToWidthRatio = (currentFontSize / $line.width()).toFixed(6);

          newFontSize = maxLineWidth * fontToWidthRatio * 0.995;
          $line.css('font-size', newFontSize + 'em');
        }

        // Exceptional cases will produce lines which are too long; resize
        while ($line.width() > maxLineWidth) {
          newFontSize *= 0.99;
          $line.css('font-size', newFontSize + 'em');
        }

        // Adjust font size if it falls outside min/max bounds
        var newFontSizePx = $line.css('font-size');
        if(newFontSizePx > this.maxFontSizePx) {
          fontSize = this.maxFontSizePx / emsize;
        } else if(!!this.minFontSizePx && newFontSizePx < this.minFontSizePx) {
          fontSize = this.minFontSizePx / emsize;
          $line.css('white-space', 'normal')
        } else {
          fontSize = newFontSize;
        }
        $line.css('font-size', fontSize + 'em');

        /* Word Spacing */
        
        // Estimate necessary word spacing and divide by 3.0 to get delta
        var d = 5, m = 3;
        var currentLineWidth = $line.width();
        currentWordSpacing = parseFloat($line.css('word-spacing')) || 0;
        $line.css('word-spacing', (currentWordSpacing + d) + 'px');
        // For IE6-8
        $line.get(0).style.wordSpacing = (currentWordSpacing + d) + 'px';
        wordSpacingDelta = (maxLineWidth - currentLineWidth)
            * (d / ($line.width() - currentLineWidth)) / m;
        $line.css('word-spacing', currentWordSpacing + 'px');
        // For IE6-8
        $line.get(0).style.wordSpacing = currentWordSpacing + 'px';
        
        // Try expanding word spacing (m+1) times or until length exceeds max
        oldWordSpacing = currentWordSpacing;
        for (var i=0; i<=m; i++) {
          if ($line.width() > maxLineWidth)
            break;
          oldWordSpacing = currentWordSpacing;
          currentWordSpacing += wordSpacingDelta;
          $line.css('word-spacing', currentWordSpacing + 'px');
          // For IE6-8
          $line.get(0).style.wordSpacing = currentWordSpacing + 'px';
        }
        
        $line.css('word-spacing', oldWordSpacing + 'px');
        // For IE6-8
        $line.get(0).style.wordSpacing = oldWordSpacing + 'px';

        wordSpacing = oldWordSpacing;
      }
      
      return {
        fontSize: fontSize,
        wordSpacing: wordSpacing,
        minFontSize: minFontSize
      };
    },

    _conform: function() {
      Conformist.init();
      
      var newConformistId = 0;

      this.each(function()
      {
        var $textbox = $(this);
        var $children = Conformist.childSelector ? 
                          $textbox.find( Conformist.childSelector ) : 
                          $textbox.children();

        // Save width because it will be erased in cloned tag
        var maxLineWidth = $textbox.width();

        // Get textbox id or set it if it does not exist
        var id = $textbox.attr('id')
        if(!id) {
          id = Conformist.conformistIdPrefix + '-' + newConformistId++;
          $textbox.attr('id', id);
        }

        Conformist.clearCss(id);

        // Renumber line classes in case there were changes
        $children.addClass(function(lineNumber, className) {
          return [
            className.replace(
              new RegExp('\\b' + Conformist.lineClassPrefix + '\\d+\\b'), ''
              ),
            Conformist.lineClassPrefix + lineNumber
          ].join(' ');
        }).css('font-size', '');

        /* On the cloned textbox, the width property is erased so its children
         * will have widths sized according to their contents.
         *
         * The cloned textbox is hidden by positioning it off screen.
         * After using it to measure widths, it is deleted.
         */
        var $ctextbox = $textbox.clone(true).addClass('conform-cloned').css({
                     'fontFamily': $textbox.css('font-family'),
                     'textTransform': $textbox.css('text-transform'),
                     'wordSpacing': $textbox.css('word-spacing'),
                     'position': 'absolute',
                     'float': 'left',
                     'width': '',
                     'left': -9999,
                     'top': -9999
                   }).appendTo(document.body);

        var $cchildren = Conformist.childSelector ? 
                           $ctextbox.find( Conformist.childSelector ) : 
                           $ctextbox.children();
        var sizes = {
          fontSizes: [],
          minFontSizes: [],
          wordSpacings: []
        };

        $cchildren.each(function() {
          // Explicit float left important for measuring width
          $(this).css('float', 'left').css('font-size', '');
          var s = Conformist.calculateFontSize($(this), maxLineWidth);
          sizes.fontSizes.push(s.fontSize);
          sizes.wordSpacings.push(s.wordSpacing);
          sizes.minFontSizes.push(s.minFontSize);
        });

        $ctextbox.remove();

        $('head').append(Conformist.generateCss(id, sizes));
      });

      return this.trigger('conformed');
    }
  };

  $.fn.conform = Conformist._conform;

})(this, jQuery);
