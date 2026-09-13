import puppeteer from 'puppeteer';

const SAMPLE_PAGES = [
  'http://localhost:3001/about-us/culture.html',
  'http://localhost:3001/adas/what-is-adas.html',
  'http://localhost:3001/about-us/awards/jeff-silver-platinum-award.html'
];

const VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Mobile', width: 375, height: 667 }
];

async function validateDOMAtViewport(page, viewport) {
  await page.setViewport(viewport);
  
  const domMath = await page.evaluate(() => {
    const hero = document.querySelector('[class*="ic-section-hero"]');
    const heading = document.querySelector('h1, h2');
    const images = document.querySelectorAll('img');
    const buttons = document.querySelectorAll('button, [role="button"]');
    
    const results = {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      hero: null,
      heading: null,
      images: [],
      buttons: [],
      textNodes: 0,
      inlineHtmlViolations: []
    };
    
    // Hero section measurements
    if (hero) {
      const rect = hero.getBoundingClientRect();
      const styles = window.getComputedStyle(hero);
      results.hero = {
        width: rect.width,
        height: rect.height,
        padding: styles.padding,
        display: styles.display,
        classes: hero.className
      };
    }
    
    // Heading measurements
    if (heading) {
      const styles = window.getComputedStyle(heading);
      results.heading = {
        text: heading.textContent.substring(0, 50),
        fontSize: styles.fontSize,
        lineHeight: styles.lineHeight,
        fontWeight: styles.fontWeight
      };
    }
    
    // Image validation
    images.forEach(img => {
      results.images.push({
        src: img.src.substring(img.src.lastIndexOf('/') + 1),
        alt: img.alt || '[NO ALT TEXT]',
        width: img.width,
        height: img.height
      });
    });
    
    // Button measurements
    buttons.forEach((btn, idx) => {
      if (idx < 3) {
        const styles = window.getComputedStyle(btn);
        results.buttons.push({
          text: btn.textContent.substring(0, 30),
          padding: styles.padding,
          fontSize: styles.fontSize
        });
      }
    });
    
    // Count text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim().length > 0) {
        results.textNodes++;
      }
    }
    
    // Check for inline HTML violations
    const bodyHtml = document.body.innerHTML;
    if (bodyHtml.includes('bodyHtml') || bodyHtml.includes('paragraphsHtml') || 
        bodyHtml.includes('contentHtml') || bodyHtml.includes('html:')) {
      results.inlineHtmlViolations.push('Found inline HTML key references');
    }
    
    return results;
  });
  
  return domMath;
}

async function runQAValidation() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('🧪 QA DOM VALIDATION - Phase 3\n');
    console.log('='.repeat(80));
    
    for (const pageUrl of SAMPLE_PAGES) {
      const pageName = pageUrl.split('/').slice(-1)[0];
      console.log(`\n📄 Page: ${pageName}`);
      console.log('-'.repeat(80));
      
      const page = await browser.newPage();
      
      try {
        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        for (const viewport of VIEWPORTS) {
          console.log(`\n  📐 ${viewport.name} (${viewport.width}x${viewport.height}):`);
          
          const domMath = await validateDOMAtViewport(page, viewport);
          
          // Hero section
          if (domMath.hero) {
            console.log(`    ✓ Hero: ${domMath.hero.width.toFixed(0)}px × ${domMath.hero.height.toFixed(0)}px`);
            console.log(`      Classes: ${domMath.hero.classes.substring(0, 60)}`);
          }
          
          // Heading
          if (domMath.heading) {
            console.log(`    ✓ Heading: "${domMath.heading.text}..."`);
            console.log(`      Font: ${domMath.heading.fontSize} / ${domMath.heading.lineHeight}`);
          }
          
          // Images
          if (domMath.images.length > 0) {
            console.log(`    ✓ Images: ${domMath.images.length} found`);
            domMath.images.slice(0, 2).forEach(img => {
              console.log(`      - ${img.src} [alt: ${img.alt.substring(0, 40)}]`);
            });
          }
          
          // Text nodes
          console.log(`    ✓ Text nodes: ${domMath.textNodes}`);
          
          // Violations
          if (domMath.inlineHtmlViolations.length > 0) {
            console.log(`    ❌ VIOLATIONS: ${domMath.inlineHtmlViolations.join(', ')}`);
          } else {
            console.log(`    ✓ No inline HTML violations detected`);
          }
        }
      } catch (err) {
        console.log(`  ❌ Error loading page: ${err.message}`);
      } finally {
        await page.close();
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ QA VALIDATION COMPLETE\n');
    
  } catch (err) {
    console.error('❌ QA Validation failed:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

runQAValidation();
