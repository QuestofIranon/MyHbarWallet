import { createLocalVue, mount } from "@vue/test-utils";
import AccountTileButtons from "../../src/components/AccountTileButtons.vue";
import VueCompositionApi from "@vue/composition-api";

describe("AccountTileButtons.vue", (): void => {
    const localVue = createLocalVue();
    localVue.use(VueCompositionApi);
    it("renders", (): void => {
        const wrapper = mount(AccountTileButtons, {
            localVue
        });
        expect(wrapper).toMatchInlineSnapshot(`
            <div class="tile-grid">
              <div class="account-tile-button"><img src="" class="tile-image">
                <div class="text">
                  <div class="title">Hardware</div>
                  <div class="content">Trezor (support for more wallets in development)</div>
                  <div class="note"></div>
                </div>
              </div>
              <div class="account-tile-button"><img src="" class="tile-image">
                <div class="text">
                  <div class="title">Software</div>
                  <div class="content">Keystore file, Private key, Mnemonic phrase</div>
                  <div class="note">Not Recommended</div>
                </div>
              </div>
            </div>
        `);
    });
});