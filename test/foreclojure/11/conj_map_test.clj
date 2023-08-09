(deftest conj-map-test
  (is (= {:a 1, :b 2, :c 3} (conj {:a 1} kv [:c 3]))))