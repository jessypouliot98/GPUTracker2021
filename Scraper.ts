import puppeteer, { Browser, Page } from 'puppeteer';

export const DEBUG_SCREENSHOT = 'debug.png';

class Scraper {

    protected _browser?: Browser;
    protected _page?: Page;

    public static async init() {
        return (new this()).init();
    }

    public async init() {
        console.log('Starting..');

        this._browser = await puppeteer.launch();

        console.log('Started.');

        return this;
    }

	protected async debugScreenshot(page: Page) {
		if ((process.env.DEBUG || '').toUpperCase() === 'TRUE') {
			await page.screenshot({ path: DEBUG_SCREENSHOT });
		}
	}

    public async search(url: string, waitForSelector: string, selector: string, callback: (elements: Element[], ...args: unknown[]) => any): Promise<[Page|undefined, any]> {
        let page;

		const waitForFullPage = async(page: Page) => {
			await page.setViewport({ width: 1920, height: 1080 });

			await this.debugScreenshot(page);

			await page.waitForSelector(waitForSelector);

			while (true) {
				await this.debugScreenshot(page);

				await page.evaluate((waitForSelector) => {
					const node = document.querySelector<Element>(waitForSelector);
					window.scrollTo(0, node?.getBoundingClientRect()?.bottom || window.innerHeight);
				}, waitForSelector);

				try {
					await page.waitForResponse((response: any) => response.status() === 200, {
						timeout: 5000,
					});
				} catch (e) {
					break;
				}
			}
		}

        try {
            console.log(`Loading ${url}`);

            page = await this.loadPage(url);

            console.log('Page loaded.');

            console.log(`Waiting for selector "${waitForSelector}"..`);

			await waitForFullPage(page);

            console.log('Done.');

            const response = await page.$$eval(selector, callback);

            return [page, response];
        } catch (e) {
			console.error(e);
            console.log('Failed.');

            return [page, []];
        }
    }

    public async navigate(url: string, options?: any): Promise<[Page]> {
        const page = await this.loadPage(url, options);

        return [page];
    }

    protected async loadPage(url: string, options?: any): Promise<Page> {
        const page: Page = await (this._browser as Browser).newPage();

        await page.goto(url, options);

        this._page = page;

        return page;
    }

}

export default Scraper;
