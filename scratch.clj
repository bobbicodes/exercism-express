(require '[babashka.fs :as fs]
         '[clojure.string :as str]
         '[cheshire.core :as json])

(def practice-exercises
  (map #(subs (str %) 19)
       (fs/list-dir "exercises\\practice")))

(def instructions-all
  (for [slug practice-exercises]
    (let [f (fs/file "exercises\\practice" slug "\\.docs\\instructions.md")]
      (slurp f))))

(def solutions-all
  (for [slug practice-exercises]
    (let [f (fs/file "exercises\\practice" slug "\\.meta\\src\\example.clj")]
      (slurp f))))

(def src-all
  (for [slug practice-exercises]
    (let [filename (str/replace slug "-" "_")
          f (fs/file "exercises\\practice" slug "src" (str filename ".clj"))]
      (slurp f))))

(def exercises
  (map #(subs (str/replace % ".clj" "") 15)
       (fs/list-dir "exercise_tests")))

(def test-all
  (for [e exercises]
    (let [f (fs/file "exercise_tests" (str e ".clj"))]
      (slurp f))))

(comment
  (spit "exercises.json" 
        (json/generate-string
         (zipmap practice-exercises src-all) 
         {:pretty true}))
  (spit "tests.json"
        (json/generate-string
         (zipmap exercises test-all)
         {:pretty true}))
  (spit "instructions.json"
        (json/generate-string
         (zipmap (map #(str/replace % "-" "_") practice-exercises)
                 instructions-all)
         {:pretty true}))
  (spit "solutions.json"
        (json/generate-string
         (zipmap (map #(str/replace % "-" "_") practice-exercises)
                 solutions-all)
         {:pretty true}))
  )

(ns reverse-string)

(defn reverse-string
  ([word] (apply str (reverse word))))

(defn hex
  "Convert an integer to a hexadecimal string"
  [n]
  (if (pos? n)
    (.toString n 16)
    (let [pn (+ 9007199254740991 n 1)
          s (.toString pn 16)]
      (if (> pn 0x0FFFFFFFFFFFFF)
        (str "3" (subs s 1))
        (let [lead (- 14 (count s))]
          (str (subs "20000000000000" 0 lead) s))))))

(Long/toOctalString -1)

(or
  (and w (let [wdth (- w decr)
               size (count s)]
           (and (< size wdth)
                (let [block (repeat (- wdth size) c)]
                  (if l
                    (apply str s block)
                    (str (apply str block) s))))))
  s)