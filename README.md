# Clean URL Copy

広告・アフィリエイト・CM等の余分なパラメータを排除してURLをコピーする Chrome 拡張です。どのサイトでも使用でき、URLからトラッキングパラメータ（UTM、広告ID、アフィリエイトIDなど）を自動的に削除します。

## 使い方

1. Chrome の拡張機能管理画面（`chrome://extensions/`）を開き、右上の「デベロッパーモード」をオンにする。
2. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このフォルダ（`note_url_copy`）を選択する。
3. 任意のページ上、もしくはリンクを右クリックし、「クリーンなURLをコピー」または「リンクのクリーンなURLをコピー」を選ぶ。
4. クリップボードにクリーンなURLがコピーされるので、任意の場所に貼り付けて利用する。

### ページに出ているURLをまとめて見る／コピーする

1. 任意のページをアクティブにする。
2. ツールバーの拡張アイコンをクリックすると、ポップアップが開き自動でURL取得が走ります。
   - もしくは拡張の「詳細」から「拡張機能のオプション」を開いても同様に自動取得されます。
3. そのページに表示されているURL一覧が表示され、各URLは自動的にクリーンアップされています。各URLをクリックするとコピーできます。

## 削除されるパラメータ

以下のようなトラッキングパラメータが自動的に削除されます：

- **UTMパラメータ**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_id`
- **広告トラッキング**: `gclid`, `fbclid`, `msclkid`, `twclid`, `li_fat_id`, `mc_cid`, `mc_eid`
- **アフィリエイト**: `affiliate_id`, `aff_id`, `aff`, `af_id`, `af`, `ref`, `referrer`, `source`
- **キャンペーン**: `campaign_id`, `campaign`, `cmp_id`
- **その他のトラッキング**: `_ga`, `_gl`, `igshid`, `igsh`, `si`, `s`, `mibextid`, `feature`, `mkt_tok`, `trk`, `trk_info`, `ncid`, `nc`, `ocid`, `oc`, `clickid`, `click_id`, `partner_id`, `partner`, `pid`, `rid`, `r`, `ref_id`, `refid`, `ref_src`, `ref_source`, `ref_medium`, `ref_campaign`, `ref_term`, `ref_content`

## 補足

- すべてのサイトで使用できます。
- クリップボード書き込みはブラウザの権限が必要です。初回利用時に許可を求められたら承認してください。

